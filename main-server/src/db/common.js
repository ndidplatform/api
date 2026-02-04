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

import cacheDbRedisInstance from './cache/redis';
import longTermDbRedisInstance from './long_term/redis';
import dataDbRedisInstance from './data/redis';
import telemetryRedisInstance from './telemetry/redis';

import CustomError from 'ndid-error/custom_error';

function getRedisInstance(dbName) {
  switch (dbName) {
    case 'cache':
      return cacheDbRedisInstance;
    case 'long-term':
      return longTermDbRedisInstance;
    case 'data':
      return dataDbRedisInstance;
    case 'telemetry':
      return telemetryRedisInstance;
    default:
      throw new CustomError({ message: 'Unknown database name' });
  }
}

export function getRedis(dbName) {
  return getRedisInstance(dbName).redis;
}

export function getRedisVersion(dbName) {
  return getRedisInstance(dbName).version;
}
