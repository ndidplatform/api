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

class RedisStreamChannel {
  constructor(redis, channel, options) {
    this.redis = redis;
    this.channel = channel;
    this.countLimit = options.countLimit || 1000;
    this.lastSeenKey = "0";

    this.redis.xadd(this.channel, "*", "node-tmp", "qweruioqpwufipqowec");
  }

  async read() {
    const messages = await this.redis.xread(['COUNT', this.countLimit, 'STREAMS', this.channel, this.lastSeenKey]);
    if (messages == null) return [];
    return messages[0][1];
  }

  async removeKey(key) {
    await this.redis.xdel([this.channel, key]);
  }

  async onReadEvent(onReceived) {
    const events = await this.read();
    if (!events || events.length === 0) return;
    if (await onReceived(events)) {
      // onDone Remove key from stream
      Promise.all(
        events.map(async event => await this.removeKey(event[0]))
      );
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
    return await this.redis.get(`${this.prefix}:${key}`, value);
  }
}

export default class RedisPMSDb extends Redis {
  constructor(options) {
    super(options);
  }

  createKVChannel(channelName) {
    return new RedisKVDb(this, channelName);
  }

  createReadChannel(channelName, options) {
    return new RedisStreamChannel(this, channelName, options);
  }
};
