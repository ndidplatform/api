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
import crypto from 'crypto';

import * as zmq from 'zeromq';

import { maxConcurrentMessagesPerMqSocket, maxMqSockets } from '../config.js';

zmq.context.maxSockets = maxMqSockets;

let maxConn = 0;
let count = 0;

export default class MQSendSocket extends EventEmitter {
  constructor() {
    super();
    this.socketMap = new Map(); // seqId -> socket
    this.socketUsedBy = {}; // socketId -> [seqIds]
    this.socketDestMap = {}; // socketId -> destKey
    this.socketListByDest = {}; // destKey -> [sockets]
    this.seqIdList = {}; // msgId -> [seqIds]
  }

  async send(dest, payload, msgId, seqId) {
    if (!this.seqIdList[msgId]) {
      this.seqIdList[msgId] = [];
    }
    this.seqIdList[msgId].push(seqId);

    const destKey = `${dest.ip}:${dest.port}`;
    let currentSocket = null;

    if (!this.socketListByDest[destKey]) {
      this.socketListByDest[destKey] = [];
    }

    for (const socket of this.socketListByDest[destKey]) {
      if (
        this.socketUsedBy[socket.id] &&
        this.socketUsedBy[socket.id].length < maxConcurrentMessagesPerMqSocket
      ) {
        currentSocket = socket;
        break;
      }
    }

    if (!currentSocket) {
      currentSocket = this._init(dest, msgId);
      this.socketDestMap[currentSocket.id] = destKey;
      count++;
      this.emit('new_socket_connection', count);
      if (count > maxConn) {
        maxConn = count;
      }
      this.socketListByDest[destKey].push(currentSocket);
    }

    if (!this.socketUsedBy[currentSocket.id]) {
      this.socketUsedBy[currentSocket.id] = [];
    }

    this.socketUsedBy[currentSocket.id].push(seqId);
    this.socketMap.set(seqId, currentSocket);

    // Dealer sockets usually expect [empty, payload]
    try {
      await currentSocket.instance.send([Buffer.alloc(0), payload]);
    } catch (err) {
      this.emit('error', msgId, err);
    }
  }

  cleanUp(msgId, ackSeqId) {
    if (!this.seqIdList[msgId]) return; // ack for same msgId
    this.seqIdList[msgId].forEach((seqId) => {
      this._cleanUp(seqId);
    });
    delete this.seqIdList[msgId];
  }

  _cleanUp(seqId) {
    const socket = this.socketMap.get(seqId);
    if (!socket) return;

    const socketId = socket.id;
    const index = this.socketUsedBy[socketId].indexOf(seqId);

    if (index !== -1) {
      this.socketUsedBy[socketId].splice(index, 1);

      if (this.socketUsedBy[socketId].length === 0) {
        socket.instance.close();
        count--;
        this.emit('socket_connection_closed', count);

        delete this.socketUsedBy[socketId];
        const destKey = this.socketDestMap[socketId];

        const listIndex = this.socketListByDest[destKey].findIndex(
          (s) => s.id === socketId
        );
        if (listIndex !== -1) {
          this.socketListByDest[destKey].splice(listIndex, 1);
        }

        if (this.socketListByDest[destKey].length === 0) {
          delete this.socketListByDest[destKey];
        }
        delete this.socketDestMap[socketId];
      }
    }
    this.socketMap.delete(seqId);
  }

  closeAll() {
    const socketsClosed = this.socketMap.size;
    for (let [seqId, socket] of this.socketMap) {
      socket.instance.close();
      this.socketMap.delete(seqId);
    }
    return socketsClosed;
  }

  // init socket and connection to destination
  _init(dest, msgId) {
    const socket = new zmq.Dealer();

    // socket option
    // no lingering time after socket close. we want to control send by business logic
    socket.linger = 0;
    socket.receiveTimeout = -1;
    socket.sendTimeout = -1;

    const socketWrapper = {
      instance: socket,
      id: crypto.randomBytes(16).toString('base64'),
    };

    const destUri = `tcp://${dest.ip}:${dest.port}`;
    socket.connect(destUri);

    this._startReceiveLoop(socket, msgId);

    return socketWrapper;
  }

  async _startReceiveLoop(socket, msgId) {
    try {
      for await (const [emptyDelimiter, messageBuffer] of socket) {
        this.emit('message', messageBuffer);
      }
    } catch (err) {
      // Ignore errors if the socket was closed intentionally
      if (socket.writable) {
        this.emit('error', msgId, err);
      }
    }
  }
}
