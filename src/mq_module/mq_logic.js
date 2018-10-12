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

export default class MQLogic extends EventEmitter {
  constructor(config) {
    super();
    const totalTimeout = config.totalTimeout || 120000;
    this.timeout = config.timeout || 30000;
    this.maxRetries = totalTimeout / this.timeout;
    this.maxSeqId = 0;
    this.maxMsgId = Date.now();
    this.id = config.id || '';
    this.seqMap = new Map();
    this.callbacksAfterAck = {};
  }

  _cleanUp(msgId) {
    const itemToDelete = [];
    for (let [key, value] of this.seqMap) {
      if (value.msgId == msgId) {
        clearTimeout(value.timerId);
        this.emit('PerformCleanUp', msgId, value.seqId);
        itemToDelete.push(key);
      }
    }
    for (let i = 0; i < itemToDelete.length; i++) {
      this.seqMap.delete(itemToDelete[i]);
    }
  }

  _performSend(dest, payload, msgId, retryCount = 0) {
    this.maxSeqId++;
    const seqId = this.maxSeqId;
    const timerId = setTimeout(
      this._retry.bind(this),
      this.timeout,
      dest,
      payload,
      msgId,
      seqId,
      ++retryCount
    );
    this.seqMap.set(seqId, {
      seqId: seqId,
      msgId: msgId,
      timerId: timerId,
    });
    this.emit('PerformSend', {
      id: this.id,
      dest: dest,
      payload: payload,
      msgId: msgId,
      seqId: seqId,
    });
  }

  _retry(dest, payload, msgId, seqId, retryCount) {
    if (this.seqMap.has(seqId)) {
      if (retryCount >= this.maxRetries) {
        this._cleanUp(msgId);
        this.emit('PerformTotalTimeout', {
          id: this.id,
          msgId: msgId,
        });
      } else {
        this._performSend(dest, payload, msgId, retryCount);
      }
    }
  }

  cleanUp(msgId) {
    this._cleanUp(msgId);
    if (this.callbacksAfterAck[msgId]) {
      this.callbacksAfterAck[msgId]();
      delete this.callbacksAfterAck[msgId];
    }
  }

  send(dest, payload, callbackAfterAck) {
    if (!Buffer.isBuffer(payload)) {
      throw new Error('Expect payload to be Buffer');
    }
    this.maxMsgId++;
    this.callbacksAfterAck[this.maxMsgId] = callbackAfterAck;
    this._performSend(dest, payload, this.maxMsgId);
    return this.maxMsgId;
  }

  stopAllRetries() {
    for (let [key, value] of this.seqMap) {
      clearTimeout(value.timerId);
    }
  }
}
