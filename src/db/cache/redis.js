import Redis from 'ioredis';
import { ExponentialBackoff } from 'simple-backoff';

import logger from '../../logger';

import * as config from '../../config';

const dbName = 'cache';

let backoff = new ExponentialBackoff({
  min: 1000,
  max: 15000,
  factor: 2,
  jitter: 0,
});

export const redis = new Redis({
  host: config.dbIp,
  port: config.dbPort,
  password: config.dbPassword,
  retryStrategy: function(times) {
    return backoff.next();
  },
  lazyConnect: true,
});

export let connected = false;

redis.on('connect', function() {
  logger.info({
    message: `DB (${dbName}): Connected to Redis server`,
  });
  connected = true;
  backoff.reset();
});

redis.on('close', function() {
  connected = false;
});

redis.on('error', function(error) {
  logger.error({
    message: `DB (${dbName}): Cannot connect to Redis server`,
    error,
  });
});

export function connect() {
  return redis.connect();
}

export function close() {
  return redis.disconnect();
}
