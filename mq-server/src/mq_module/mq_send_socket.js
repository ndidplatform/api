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
    this.socketUsedBy = new Map(); // socketId -> [seqIds]
    this.socketDestMap = new Map(); // socketId -> destKey
    this.socketListByDest = new Map(); // destKey -> [sockets]
    this.seqIdList = new Map(); // msgId -> [seqIds]
  }

  async send(dest, payload, msgId, seqId) {
    if (!this.seqIdList.has(msgId)) {
      this.seqIdList.set(msgId, []);
    }
    this.seqIdList.get(msgId).push(seqId);

    const destKey = `${dest.ip}:${dest.port}`;
    let currentSocket = null;

    if (!this.socketListByDest.has(destKey)) {
      this.socketListByDest.set(destKey, []);
    }

    const socketsForDest = this.socketListByDest.get(destKey);
    for (const socket of socketsForDest) {
      const usedBy = this.socketUsedBy.get(socket.id);
      if (usedBy && usedBy.length < maxConcurrentMessagesPerMqSocket) {
        currentSocket = socket;
        break;
      }
    }

    if (!currentSocket) {
      currentSocket = this._init(dest, msgId);
      this.socketDestMap.set(currentSocket.id, destKey);
      count++;
      this.emit('new_socket_connection', count);
      if (count > maxConn) {
        maxConn = count;
      }
      this.socketListByDest.get(destKey).push(currentSocket);
    }

    if (!this.socketUsedBy.has(currentSocket.id)) {
      this.socketUsedBy.set(currentSocket.id, []);
    }

    this.socketUsedBy.get(currentSocket.id).push(seqId);
    this.socketMap.set(seqId, currentSocket);

    // Dealer sockets usually expect [empty, payload]
    try {
      await currentSocket.instance.send([Buffer.alloc(0), payload]);
    } catch (err) {
      this.emit('error', msgId, err);
    }
  }

  cleanUp(msgId, ackSeqId) {
    if (!this.seqIdList.has(msgId)) return; // ack for same msgId

    this.seqIdList.get(msgId).forEach((seqId) => {
      this._cleanUp(seqId);
    });
    this.seqIdList.delete(msgId);
  }

  _cleanUp(seqId) {
    const socket = this.socketMap.get(seqId);
    if (!socket) return;

    const socketId = socket.id;
    const usedByList = this.socketUsedBy.get(socketId);

    if (usedByList) {
      const index = usedByList.indexOf(seqId);

      if (index !== -1) {
        usedByList.splice(index, 1);

        if (usedByList.length === 0) {
          socket.instance.close();
          count--;
          this.emit('socket_connection_closed', count);

          this.socketUsedBy.delete(socketId);
          const destKey = this.socketDestMap.get(socketId);

          const destSockets = this.socketListByDest.get(destKey);
          if (destSockets) {
            const listIndex = destSockets.findIndex((s) => s.id === socketId);
            if (listIndex !== -1) {
              destSockets.splice(listIndex, 1);
            }

            if (destSockets.length === 0) {
              this.socketListByDest.delete(destKey);
            }
          }
          this.socketDestMap.delete(socketId);
        }
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
