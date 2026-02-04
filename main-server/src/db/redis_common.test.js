import { expect } from 'chai';
import sinon from 'sinon';

import Redis from 'ioredis';

import * as redisCommon from './common';
import { pushToList, getAllLists } from './redis_common';

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
});
