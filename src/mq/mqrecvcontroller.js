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

import * as util from 'util';
import EventEmitter from 'events';
import MQProtocol from './mqprotocol.js';
import MQRecvSocket from './mqrecvsocket.js';

let protocol = new MQProtocol();

let MQRecv = function(config) {
  this.recvSocket = new MQRecvSocket({
    maxMsgSize: config.maxMsgSize, 
    port: config.port,
  });

  this.ackSave = {};

  this.recvSocket.on('message',  function(jsonMessageStr) {
    const jsonMessage = protocol.ExtractMsg(jsonMessageStr);
    const ackMSG = protocol.GenerateAckMsg({
      msgId: jsonMessage.retryspec.msgId, 
      seqId: jsonMessage.retryspec.seqId
    });

    this.recvSocket.send(ackMSG);

    const msgId = jsonMessage.retryspec.msgId;
    const senderId = jsonMessage.retryspec.senderId;

    //first time received from this sender
    if(!this.ackSave[senderId]) this.ackSave[senderId] = {};

    //this message not received yet
    if(!this.ackSave[senderId][msgId]) {
      this.emit('message', jsonMessage.message);
      this.ackSave[senderId][msgId] = true;
      let _this = this;
      setTimeout(() => {
        delete _this.ackSave[senderId][msgId];
      }, config.ackSaveTimeout);
    }

  }.bind(this));

  this.recvSocket.on('error',  function(error) {
    this.emit('error', error);
  }.bind(this));
};

util.inherits(MQRecv, EventEmitter);

export default MQRecv;
