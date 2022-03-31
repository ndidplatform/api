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
    /**
     * @type {Redis.Redis}
     */
    this.redis = redis;
    this.channel = channel;

    this.countLimit = options.countLimit || 1000;

    this.streamMaxCapacity = options.streamMaxCapacity;

    if (this.streamMaxCapacity) {
      this.setStreamMaxCapacity();
    }
  }

  async setStreamMaxCapacity() {
    logger.debug({
      message: `Setting Stream Max Capacity (channel: ${this.channel}) to ${this.streamMaxCapacity}`,
    });
    await this.redis.xtrim([
      this.channel,
      'MAXLEN',
      '~',
      this.streamMaxCapacity,
    ]);
  }

  async read() {
    logger.debug({
      message: `Attempt Reading Redis (channel: ${this.channel})`,
    });
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

  async onReadStreamData(onReceived) {
    for (;;) {
      const entries = await this.read();
      if (!entries || entries.length === 0) {
        logger.debug({
          message: `No entries (channel: ${this.channel})`,
        });
        return 0;
      }
      const keys = entries.map((entry) => entry[0]);
      const data = entries.map((entry) => {
        const data = entry[1];
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
          logger.error({ err: error });
        }

        if (entries.length == this.countLimit) {
          // if the entries exceed count limit, call start again
          continue;
        }
      }

      return entries.length;
    }
  }
}

class RedisKVDb {
  constructor(redis, prefix) {
    this.redis = redis;
    this.prefix = prefix;
  }

  async getKey(key) {
    try {
      return await this.redis.get(`${this.prefix}:${key}`);
    } catch (e) {
      return undefined;
    }
  }

  async setKey(key, value) {
    return await this.redis.set(`${this.prefix}:${key}`, value);
  }

  async unlinkKey(key) {
    return await this.redis.unlink(`${this.prefix}:${key}`);
  }

  async publish(key, value) {
    return await this.redis.publish(`${this.prefix}:${key}`, value);
  }
}

export default class RedisTelemetryDb extends Redis {
  constructor({ backoff, onDisconnected, onConnected }) {
    super({
      host: config.redisDbHost,
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
      logger.error({ err: error });
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
