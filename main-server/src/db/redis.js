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

import EventEmitter from 'events';

import Redis from 'ioredis';
import { ExponentialBackoff } from 'simple-backoff';

import logger from '../logger';

import * as config from '../config';

export default class RedisInstance extends EventEmitter {
  constructor(dbName) {
    super();
    this.dbName = dbName;
    this.backoff = new ExponentialBackoff({
      min: 1000,
      max: 15000,
      factor: 2,
      jitter: 0,
    });

    this.connected = false;
    this.reconnecting = false;

    this.redis = new Redis({
      host: config.dbIp,
      port: config.dbPort,
      password: config.dbPassword,
      retryStrategy: (times) => {
        return this.backoff.next();
      },
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      logger.info({
        message: `DB (${dbName}): Connected to Redis server`,
      });
      this.connected = true;
      this.backoff.reset();
      if (this.reconnecting) {
        this.emit('reconnect');
        this.reconnecting = false;
      }
    });

    this.redis.on('reconnecting', () => {
      this.reconnecting = true;
    });

    this.redis.on('close', () => {
      this.connected = false;
    });

    this.redis.on('error', (error) => {
      logger.error({
        message: `DB (${this.dbName}): Cannot connect to Redis server`,
        error,
      });
    });
  }

  connect() {
    return new Promise(async (resolve) => {
      this.redis.once('connect', async () => {
        await this.getRedisVersion();
        resolve();
      });
      try {
        await this.redis.connect();
      } catch (error) {
        logger.warn({
          message: `DB (${
            this.dbName
          }): Cannot connect to Redis the first time`,
          error,
        });
      }
    });
  }

  async getRedisVersion() {
    const info = await this.redis.info();
    const parsedInfo = parseInfo(info);
    const redisVersion = parsedInfo.redis_version;
    const versionArr = redisVersion.split('.');
    const version = {
      major: versionArr[0],
      minor: versionArr[1],
      patch: versionArr[2],
    };
    this.version = version;
  }

  close() {
    return this.redis.disconnect();
  }
}

function parseInfo(info) {
  const lines = info.split('\r\n');
  const obj = {};
  for (var i = 0, l = info.length; i < l; i++) {
    let line = lines[i];
    if (line && line.split) {
      line = line.split(':');
      if (line.length > 1) {
        const key = line.shift();
        obj[key] = line.join(':');
      }
    }
  }
  return obj;
}
