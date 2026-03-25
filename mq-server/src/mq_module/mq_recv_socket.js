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

import * as zmq from 'zeromq';

export default class MQRecvSocket extends EventEmitter {
  constructor(config) {
    super();

    this.receivingSocket = new zmq.Router();

    // maximum receiver size ( -1 receive all )
    this.receivingSocket.maxMessageSize = config.maxMsgSize || -1;
    // no lingering time after socket close. we want to control send by business logic
    this.receivingSocket.linger = 0;

    this.port = config.port;
    this.closed = false;

    this.sendChain = Promise.resolve();
  }

  // Initialize the socket and start the receive loop
  async init() {
    await this.receivingSocket.bind(`tcp://*:${this.port}`);

    this._receiveLoop();
  }

  async _receiveLoop() {
    try {
      for await (const [identity, emptyDelimiter, messageBuffer] of this
        .receivingSocket) {
        this.emit('message', identity, messageBuffer);

        if (this.closed) break;
      }
    } catch (err) {
      if (!this.closed) {
        this.emit('error', err);
      }
    }
  }

  unsafeSend(identity, payload) {
    // Router sockets require the [identity, empty, payload] structure
    return this.receivingSocket.send([identity, Buffer.alloc(0), payload]);
  }

  async send(identity, payload) {
    // Wait for previous send to finish before calling another send to prevent 
    // Error: Socket is busy writing; only one send operation may be in progress at any time
    this.sendChain = this.sendChain.then(async () => {
      try {
        await this.unsafeSend(identity, payload);
      } catch (err) {
        this.emit('error', err);
      }
    });

    return this.sendChain;
  }

  close() {
    this.closed = true;
    this.receivingSocket.close();
  }
}
