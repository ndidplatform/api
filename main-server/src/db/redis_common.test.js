import { expect } from 'chai';
import sinon from 'sinon';

import Redis from 'ioredis';

import { slidingWindowScript } from './cache/redis';

import * as redisCommon from './common';
import {
  pushToList,
  getAllLists,
  setToNewKey,
  checkRateLimit,
} from './redis_common';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

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
    sinon.stub(redisCommon, 'getRedisVersion').returns({ major: '5' });
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

  describe('setToNewKey()', () => {
    beforeEach(async () => {
      // Ensure the test DB is empty before every test
      await redis.flushdb();
    });

    it('should copy value from old key to new key and remove old key', async () => {
      const name = 'setToNewKet_test';

      const oldKey = 'user:1001';
      const newKey = 'user:2002';

      const fullOldKey = `${nodeId}:${testDbName}:${name}:${oldKey}`;
      const fullNewKey = `${nodeId}:${testDbName}:${name}:${newKey}`;

      // Seed initial data on Redis
      const setRes = await redis.set(fullOldKey, 'sample_value');
      expect(setRes).to.equal('OK');

      await setToNewKey({
        nodeId,
        dbName: testDbName,
        name,
        key: oldKey,
        newKey,
      });

      // Verify old key was unlinked/deleted and new key received the value
      const oldVal = await redis.get(fullOldKey);
      const newVal = await redis.get(fullNewKey);

      expect(oldVal).to.be.null;
      expect(newVal).to.equal('sample_value');
    });

    it('should fall back to DEL for Redis versions lower than 4', async () => {
      // Temporarily mock Redis major version to 3
      redisCommon.getRedisVersion.returns({ major: '3' });

      const name = 'setToNewKet_test_old_ver';

      const oldKey = 'legacy:old';
      const newKey = 'legacy:new';

      const fullOldKey = `${nodeId}:${testDbName}:${name}:${oldKey}`;
      const fullNewKey = `${nodeId}:${testDbName}:${name}:${newKey}`;

      await redis.set(fullOldKey, 'legacy_value');

      await setToNewKey({
        nodeId,
        dbName: testDbName,
        name,
        key: oldKey,
        newKey,
      });

      const oldVal = await redis.get(fullOldKey);
      const newVal = await redis.get(fullNewKey);

      expect(oldVal).to.be.null;
      expect(newVal).to.equal('legacy_value');

      // Reset stub version back to 5
      redisCommon.getRedisVersion.returns({ major: '5' });
    });

    it('should set new key to null when old key does not exist', async () => {
      const name = 'setToNewKet_test_no_oldKey';

      const oldKey = 'non_existent_old';
      const newKey = 'new_target';

      const fullNewKey = `${nodeId}:${testDbName}:${name}:${newKey}`;

      try {
        await setToNewKey({
          nodeId,
          dbName: testDbName,
          name: 'setToNewKet_test_no_oldKey',
          key: oldKey,
          newKey,
        });
        expect.fail('Should have thrown CustomError');
      } catch (err) {
        expect(err).to.be.an.instanceOf(CustomError);
        expect(err.code).to.equal(errorType.DB_ERROR.code);
        expect(err.details).to.deep.equal({
          operation: 'setToNewKey',
          dbName: testDbName,
          name: 'setToNewKet_test_no_oldKey',
        });
      }

      const newVal = await redis.get(fullNewKey);
      expect(newVal).to.be.null;
    });

    it('should wrap Redis errors inside CustomError', async () => {
      // Simulate connection issue by forcing getRedis to throw
      redisCommon.getRedis.throws(new Error('Redis connection down'));

      try {
        await setToNewKey({
          nodeId,
          dbName: testDbName,
          name: 'setToNewKet_test_err',
          key: 'k1',
          newKey: 'k2',
        });
        expect.fail('Should have thrown CustomError');
      } catch (err) {
        expect(err).to.be.an.instanceOf(CustomError);
        expect(err.code).to.equal(errorType.DB_ERROR.code);
        expect(err.cause.message).to.equal('Redis connection down');
        expect(err.details).to.deep.equal({
          operation: 'setToNewKey',
          dbName: testDbName,
          name: 'setToNewKet_test_err',
        });
      } finally {
        // Restore normal getRedis implementation for subsequent tests
        redisCommon.getRedis.returns(redis);
      }
    });
  });
});
