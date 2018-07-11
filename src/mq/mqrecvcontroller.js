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

let EventEmitter = require('events').EventEmitter;
let util = require ('util');
import MQProtocol from './mqprotocol.js';
import CustomError from '../error/customError';
import MQRecvSocket from './mqrecvsocket.js'

let protocol = new MQProtocol();

let MQRecv = function(config) {
  this.recvSocket  = new MQRecvSocket({maxMsgSize:config.maxMsgSize, port:config.port})

  this.recvSocket.on('message',  function(jsonMessageStr) {
    
      const jsonMessage = protocol.ExtractMsg(jsonMessageStr);
      const ackMSG = protocol.GenerateAckMsg({msgId:jsonMessage.retryspec.msgId, seqId:jsonMessage.retryspec.seqId});

      this.recvSocket.send(ackMSG);
      this.emit('message', jsonMessage.message);
  }.bind(this));

  this.recvSocket.on('error',  function(error) {
      this.emit('error', error);
  }.bind(this));
};

util.inherits(MQRecv, EventEmitter);

module.exports = MQRecv;
