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

export default class MQRecvSocket extends EventEmitter {
  constructor(config) {
    super();
    this.receivingSocket = zmq.socket('rep');
    // maximum receiver size ( -1 receive all )
    this.receivingSocket.setsockopt(
      zmq.ZMQ_MAXMSGSIZE,
      config.maxMsgSize || -1
    );
    //no lingering time after socket close. we want to control send by business logic
    this.receivingSocket.setsockopt(zmq.ZMQ_LINGER, 0);
    // no socket identity ( every time the app restart, we don't resume)
    //this.receivingSocket.setsockopt(zmq.ZMQ_IDENTITY,{}) ;
    this.receivingSocket.bindSync('tcp://*:' + config.port);

    this.receivingSocket.on(
      'message',
      function(jsonMessageStr) {
        this.emit('message', jsonMessageStr);
      }.bind(this)
    );

    this.receivingSocket.on(
      'error',
      function(error) {
        this.emit('error', error);
      }.bind(this)
    );
  }

  send(payload) {
    this.receivingSocket.send(payload);
  }

  close() {
    this.receivingSocket.close();
  }
}
