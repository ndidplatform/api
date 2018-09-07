import Redis from 'ioredis';

import * as config from '../../config';

export const redis = new Redis({
  port: config.redisPort,
  host: config.redisIp,
  // family: 4, // 4 (IPv4) or 6 (IPv6)
});

export function close() {
  return redis.disconnect();
}
