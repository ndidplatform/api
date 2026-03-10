import { expect } from 'chai';
import sinon from 'sinon';

import Redis from 'ioredis';

import { slidingWindowScript } from './cache/redis';

import * as redisCommon from './common';
import { pushToList, getAllLists, checkRateLimit } from './redis_common';

describe('Integration Test with Redis', () => {
  let redis;
  const testDbName = 'test';
  const nodeId = 'node_test';

  before(async function () {
    if (!process.env.RUN_INTEGRATION_TESTS) {
      this.skip();
    }

    // Connect to a local Redis instance on a high DB index (e.g., 15)
    redis = new Redis('redis://127.0.0.1:6379/15');

    redis.defineCommand('checkRateLimit', {
      numberOfKeys: 1,
      lua: slidingWindowScript,
    });

    sinon.stub(redisCommon, 'getRedis').returns(redis);
  });

  after(async () => {
    if (redis) {
      await redis.quit();
    }
    sinon.restore();
  });

  describe('getAllLists()', () => {
    beforeEach(async () => {
      // Ensure the test DB is empty before every test
      await redis.flushdb();
    });

    it('should retrieve multiple items pushed to the same key', async () => {
      const key = 'request_999';
      const task1 = { fnName: 'task1', startTime: Date.now() };
      const task2 = { fnName: 'task2', startTime: Date.now() + 100 };

      await pushToList({
        nodeId,
        dbName: testDbName,
        name: 'queue',
        key,
        value: task1,
      });
      await pushToList({
        nodeId,
        dbName: testDbName,
        name: 'queue',
        key,
        value: task2,
      });

      const result = await getAllLists({
        nodeId,
        dbName: testDbName,
        name: 'queue',
        keyName: 'requestId',
        valueName: 'tasks',
      });

      expect(result).to.be.an('array').with.lengthOf(1);
      expect(result[0].requestId).to.equal(key);
      expect(result[0].tasks).to.be.an('array').with.lengthOf(2);
      expect(result[0].tasks[0].fnName).to.equal('task1');
      expect(result[0].tasks[1].fnName).to.equal('task2');
    });

    it('should handle multiple distinct keys', async () => {
      await pushToList({
        nodeId,
        dbName: testDbName,
        name: 'queue',
        key: 'A',
        value: { id: 'A' },
      });
      await pushToList({
        nodeId,
        dbName: testDbName,
        name: 'queue',
        key: 'B',
        value: { id: 'B' },
      });

      const result = await getAllLists({
        nodeId,
        dbName: testDbName,
        name: 'queue',
        keyName: 'requestId',
        valueName: 'tasks',
      });

      expect(result).to.have.lengthOf(2);
      const ids = result.map((r) => r.requestId);
      expect(ids).to.contain('A');
      expect(ids).to.contain('B');
    });
  });

  describe('checkRateLimit()', () => {
    const requestId = 'request_123';
    const limit = 10;
    const hourInMs = 3600000;

    beforeEach(async () => {
      // Ensure the test DB is empty before every test
      await redis.flushdb();
    });

    // Helper function to call the limiter
    async function callLimiter(id, customTime = Date.now()) {
      return await checkRateLimit({
        nodeId,
        dbName: testDbName,
        name: 'YourData_keyRetryRequestDataRateLimit',
        key: id,
        now: customTime,
        windowMs: hourInMs,
        limit,
      });
    }

    it('should allow a single request and return 9 remaining', async () => {
      const res = await callLimiter(requestId);
      expect(res.allowed).to.be.true;
      expect(res.remaining).to.equal(9);
    });

    it('should block the 11th request within the same hour', async () => {
      // Perform 10 requests
      for (let i = 0; i < 10; i++) {
        const res = await callLimiter(requestId);
      }

      // The 11th request should fail
      const res = await callLimiter(requestId);
      expect(res.allowed).to.be.false;
      expect(res.remaining).to.equal(0);
    });

    it('should "slide" and allow requests after the oldest ones expire', async () => {
      const now = Date.now();
      const eightyMinutesAgo = now - 80 * 60 * 1000;

      // Simulate 10 requests that happened over an hour ago
      for (let i = 0; i < 10; i++) {
        await callLimiter(requestId, eightyMinutesAgo + i);
      }

      // Current request should be allowed because the old ones "slid" out
      const res = await callLimiter(requestId, now);
      expect(res.allowed).to.be.true;
      expect(res.remaining).to.equal(9);
    });

    it('should handle different requests independently', async () => {
      // Exhaust limit for Request A
      for (let i = 0; i < 10; i++) {
        await callLimiter('request_A');
      }

      // Request B should still be allowed
      const resB = await callLimiter('request_B');
      expect(resB.allowed).to.be.true;
      expect(resB.remaining).to.equal(9);
    });
  });
});
