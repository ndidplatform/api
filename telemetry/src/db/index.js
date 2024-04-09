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

import RedisTelemetryDb from './redis';

import { ExponentialBackoff } from 'simple-backoff';

class TriggerTimeout {
  constructor(triggerFn, options = {}) {
    this.triggerFn = triggerFn;
    this.counter = 0;

    this.countLimit = options.countLimit || 10000;
    this.timeLimit = options.timeLimit || 10000;

    this.resetCounter();
    if (options.startImmediately) {
      this.trigger();
    } else {
      this.startTimer(this.timeLimit);
    }
  }

  async trigger() {
    this.resetCounter();
    const result = await this.triggerFn();
    this.restartTimer();
    return result;
  }

  // onReceived will count the number of packages in the queue
  resetCounter() {
    this.counter = 0;
  }

  increaseCounter(numEvents = 1) {
    this.counter += numEvents;
    if (this.counter >= this.countLimit) {
      this.trigger();
    }
  }

  // trigger interval will periodically trigger the function
  restartTimer(timeLimit) {
    if (this.triggerTimerID) {
      clearTimeout(this.triggerTimerID);
    }
    this.triggerTimerID = setTimeout(
      async () => await this.trigger(),
      timeLimit || this.timeLimit
    );
  }

  stopTimer() {
    if (this.triggerTimerID) {
      clearTimeout(this.triggerTimerID);
    }
  }

  startTimer(timeLimit) {
    this.restartTimer(timeLimit || this.timeLimit);
  }
}

export default class TelemetryDb {
  /*
   @param {Object} channels
    an object of connection channels with `channelID` as key and `channel` as value
   @param {function () => bool} channel.onDataReceived
    a callback function called when there are enough messages to transport or the timer is trigger
   @param {string} channelName
    name of the channel
   @param {integer} channel.timeLimit
    a timelimit (in ms) before timer is trigger
   @param {integer] channel.countLimit
    a number of events before timer is trigger
  */
  constructor(channels) {
    this.backoff = new ExponentialBackoff({
      min: 1000,
      max: 15000,
      factor: 2,
      jitter: 0,
    });

    this.connected = false;

    this.client = new RedisTelemetryDb({
      backoff: this.backoff,
      onConnected: () => this.onConnected(),
      onDisconnected: () => this.onDisconnected(),
    });

    this.dbs = new Object();
    channels.forEach((channelInfo) => {
      const { id, type, onCreated, delayStart } = channelInfo;

      let db;
      if (type === 'key-value') {
        const { keyPrefix } = channelInfo;
        db = this.client.createKVChannel(keyPrefix);
      } else if (type === 'stream') {
        const {
          channelName,
          onDataReceived,
          countLimit,
          timeLimit,
          streamMaxCapacity,
        } = channelInfo;

        db = this.client.createReadChannel(channelName, {
          countLimit,
          streamMaxCapacity,
        });

        setTimeout(() => {
          const timer = new TriggerTimeout(
            async () => {
              if (this.connected) {
                await db.onReadStreamData(onDataReceived);
              }
            },
            {
              countLimit,
              timeLimit,
              startImmediately: true, // initial trigger
            }
          );

          // subscribe for event counter
          // this.client.subscribe(channelName, (data) => (data != undefined) && buffer.increaseCounter());
        }, delayStart);
      } else {
        throw new Error(`undefined db type ${type}`);
      }

      this.dbs[id] = db;

      if (onCreated) {
        onCreated(db);
      }
    });
  }

  onConnected() {
    this.connected = true;
  }

  onDisconnected() {
    this.connected = false;
  }
}
