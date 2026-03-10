/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 *
 * This file is part of NDID software.
 *
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 *
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 *
 * Please contact info@ndid.co.th for any further questions
 *
 */

import RedisInstance from '../redis';

const dbName = 'cache';

const redisInstance = new RedisInstance(dbName);

// rate limiting lua script
export const slidingWindowScript = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  -- Random suffix to ensure uniqueness in the same millisecond
  local nonce = ARGV[4]
  local clearBefore = now - window

  -- Remove old entries
  redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

  -- Count current entries
  local amount = redis.call('ZCARD', key)

  if amount < limit then
    -- Store the member as "timestamp:nonce" to ensure uniqueness
    -- But keep the score as just the timestamp for range pruning
    redis.call('ZADD', key, now, now .. ':' .. nonce)
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return {1, limit - amount - 1} -- [allowed, remaining]
  else
    return {0, 0} -- [blocked, remaining]
  end
`;

redisInstance.redis.defineCommand('checkRateLimit', {
  numberOfKeys: 1,
  lua: slidingWindowScript,
});

export default redisInstance;
