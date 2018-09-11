import Redis from 'ioredis';
import { ExponentialBackoff } from 'simple-backoff';

import logger from '../../logger';

import * as config from '../../config';

const dbName = 'long-term';

let backoff = new ExponentialBackoff({
  min: 1000,
  max: 15000,
  factor: 2,
  jitter: 0,
});

export const redis = new Redis({
  host: config.dbIp,
  port: config.dbPort,
  retryStrategy: function(times) {
    return backoff.next();
  },
});

redis.on('connect', function() {
  logger.info({
    message: `DB (${dbName}): Connected to Redis server`,
  });
  backoff.reset();
});

redis.on('error', function(error) {
  logger.error({
    message: `DB (${dbName}): Cannot connect to Redis server`,
    error,
  });
});

export function close() {
  return redis.disconnect();
}
