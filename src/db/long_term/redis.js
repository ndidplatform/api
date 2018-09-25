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
