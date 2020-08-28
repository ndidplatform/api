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
import * as config from '../config';
import logger from '../logger';

class RedisStreamChannel {
  constructor(redis, channel, options) {
    this.redis = redis;
    this.channel = channel;
    this.countLimit = options.countLimit || 1000;
  }

  async read() {
    logger.debug('Attempt Reading Redis');
    const messages = await this.redis.xread([
      'COUNT',
      this.countLimit,
      'STREAMS',
      this.channel,
      0,
    ]);
    if (messages == null) return [];
    return messages[0][1];
  }

  async removeKey(key) {
    await this.redis.xdel([this.channel, key]);
  }

  async onReadEvent(onReceived) {
    for (;;) {
      const events = await this.read();
      if (!events || events.length === 0) return 0;
      const keys = events.map((event) => event[0]);
      const data = events.map((event) => {
        const data = event[1];
        const obj = {};
        for (let i = 0; i < data.length; i += 2) {
          obj[data[i]] = data[i + 1];
        }
        return obj;
      });

      if (await onReceived(data)) {
        // onDone Remove key from stream
        try {
          await Promise.all(keys.map(async (key) => await this.removeKey(key)));
        } catch (error) {
          logger.error({ error });
        }

        if (events.length == this.countLimit) {
          // if the events exceed count limit, call start again
          continue;
        }
      }

      return events.length;
    }
  }
}

class RedisKVDb {
  constructor(redis, suffix) {
    this.redis = redis;
    this.suffix = suffix;
  }

  async getKey(key) {
    try {
      return await this.redis.get(`${key}:${this.suffix}`);
    } catch (e) {
      return undefined;
    }
  }

  async setKey(key, value) {
    return await this.redis.set(`${key}:${this.suffix}`, value);
  }
}

export default class RedisTelemetryDb extends Redis {
  constructor({ backoff, onDisconnected, onConnected }) {
    super({
      host: config.redisDbIp,
      port: config.redisDbPort,
      password: config.redisDbPassword,
      retryStrategy: (times) => {
        return backoff.next();
      },
    });

    this.on('connect', () => {
      backoff.reset();
      onConnected();
    });
    this.on('error', (error) => {
      logger.error({ error });
      onDisconnected();
    });
  }

  createKVChannel(channelName) {
    return new RedisKVDb(this, channelName);
  }

  createReadChannel(channelName, options) {
    return new RedisStreamChannel(this, channelName, options);
  }
}
