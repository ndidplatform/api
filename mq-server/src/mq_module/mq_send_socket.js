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

let maxConn = 0;
let count = 0;

import EventEmitter from 'events';

import zmq from 'zeromq';
import crypto from 'crypto';

import { maxConcurrentMessagesPerMqSocket, maxMqSockets } from '../config';

export default class MQSendSocket extends EventEmitter {
  constructor() {
    super();
    this.socketMap = new Map();
    this.socketUsedBy = {};
    this.socketDestMap = {};
    this.socketListByDest = {};
    this.seqIdList = {};
    zmq.Context.setMaxSockets(maxMqSockets);
  }

  send(dest, payload, msgId, seqId) {
    if (!this.seqIdList[msgId]) {
      this.seqIdList[msgId] = [];
    }
    this.seqIdList[msgId].push(seqId);
    const destKey = dest.ip + ':' + dest.port;
    let currentSocket = null;
    if (!this.socketListByDest[destKey]) {
      this.socketListByDest[destKey] = [];
    }

    for (let i = 0; i < this.socketListByDest[destKey].length; i++) {
      let socket = this.socketListByDest[destKey][i];
      if (
        this.socketUsedBy[socket.id] &&
        this.socketUsedBy[socket.id].length < maxConcurrentMessagesPerMqSocket
      ) {
        currentSocket = socket;
        break;
      }
    }
    if (currentSocket == null) {
      const newSocket = this._init(dest, msgId);
      this.socketDestMap[newSocket.id] = destKey;
      count++;
      this.emit('new_socket_connection', count);
      if (count > maxConn) {
        // console.log(count);
        maxConn = count;
      }
      this.socketListByDest[destKey].push(newSocket);
      currentSocket = newSocket;
    }

    if (!this.socketUsedBy[currentSocket.id]) {
      this.socketUsedBy[currentSocket.id] = [];
    }
    this.socketUsedBy[currentSocket.id].push(seqId);
    this.socketMap.set(seqId, currentSocket);
    currentSocket.send([Buffer.alloc(0), payload]);
  }

  cleanUp(msgId, ackSeqId) {
    if (!this.seqIdList[msgId]) return; //ack for same msgId
    this.seqIdList[msgId].forEach((seqId) => {
      this._cleanUp(seqId);
    });
    delete this.seqIdList[msgId];
  }

  _cleanUp(seqId) {
    let socketId = this.socketMap.get(seqId).id;
    let index = this.socketUsedBy[socketId].indexOf(seqId);
    if (index !== -1) {
      this.socketUsedBy[socketId].splice(index, 1);
      if (this.socketUsedBy[socketId].length === 0) {
        this.socketMap.get(seqId).close();
        count--;
        this.emit('socket_connection_closed', count);
        delete this.socketUsedBy[socketId];
        let destKey = this.socketDestMap[socketId];
        let index = this.socketListByDest[destKey].findIndex((socket) => {
          return socket.id === socketId;
        });
        if (index === -1) {
          throw 'Something is wrong';
        }
        this.socketListByDest[destKey].splice(index, 1);
        if (this.socketListByDest[destKey].length === 0) {
          delete this.socketListByDest[destKey];
        }
        delete this.socketDestMap[socketId];
      }
    } else {
      throw 'Something is wrong';
    }
    this.socketMap.delete(seqId);
  }

  closeAll() {
    const socketsClosed = this.socketMap.size;
    for (let [seqId, sendingSocket] of this.socketMap) {
      sendingSocket.close();
      this.socketMap.delete(seqId);
    }
    return socketsClosed;
  }

  // init socket and connection to destination (init source socket too, which should provide limitation but is cleaner)
  _init(dest, msgId) {
    const sendingSocket = zmq.socket('dealer');
    // socket option
    // small lingering time ( 50ms ) after socket close. we want to control send by business logic
    sendingSocket.setsockopt(zmq.ZMQ_LINGER, 0);
    //not setting means unlimited number of queueing message
    //sendingSocket.setsockopt(zmq.ZMQ_HWM, 0);
    //ALL in MEMORY --
    //sendingSocket.setsockopt(zmq.ZMQ_SWAP, 0);
    //no block // wait forever until close
    sendingSocket.setsockopt(zmq.ZMQ_RCVTIMEO, 0);
    //no block // wait forever until close
    sendingSocket.setsockopt(zmq.ZMQ_SNDTIMEO, 0);

    sendingSocket.on(
      'error',
      function(err) {
        this.emit('error', msgId, err);
      }.bind(this)
    );

    sendingSocket.on(
      'message',
      function(emptyDelimiter, messageBuffer) {
        this.emit('message', messageBuffer);
      }.bind(this)
    );

    const destUri = `tcp://${dest.ip}:${dest.port}`;
    sendingSocket.connect(destUri);
    sendingSocket.id = crypto.randomBytes(16).toString('base64');
    return sendingSocket;
  }
}
