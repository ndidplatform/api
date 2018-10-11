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

import zmq from 'zeromq';

export default class MQSendSocket extends EventEmitter {
  constructor() {
    super();
    this.socketMap = new Map();
  }

  send(dest, payload, msgId, seqId) {
    const newSocket = this._init(dest, msgId);
    this.socketMap.set(seqId, newSocket);
    newSocket.send(payload);
  }

  cleanUp(seqId) {
    this.socketMap.get(seqId).close();
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
    const sendingSocket = zmq.socket('req');
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
      function(messageBuffer) {
        this.emit('message', messageBuffer);
      }.bind(this)
    );

    const destUri = `tcp://${dest.ip}:${dest.port}`;
    sendingSocket.connect(destUri);
    return sendingSocket;
  }
}
