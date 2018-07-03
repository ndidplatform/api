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
import * as db from '../db';

function clearAckTimer({senderId, msgId}) {
  delete this.ackSave[senderId][msgId];
  delete this.ackSaveTimerId[senderId][msgId];
  if( Object.keys(this.ackSave[senderId]).length === 0 ) {
    delete this.ackSave[senderId];
    db.removeDuplicateMessageCheck(senderId);
  }
  else { 
    db.setDuplicateMessageCheck(senderId, this.ackSave[senderId]);
  }
}

let protocol = new MQProtocol();

let MQRecv = function(config) {
  this.recvSocket = new MQRecvSocket({
    maxMsgSize: config.maxMsgSize, 
    port: config.port,
  });

  this.recvSocket.on('error',  function(error) {
    this.emit('error', error);
  }.bind(this));
};

MQRecv.prototype.close = function() {
  this.recvSocket.close();
  for(let senderId in this.ackSaveTimerId) {
    for(let msgId in this.ackSaveTimerId[senderId]) {
      clearTimeout(this.ackSaveTimerId[senderId][msgId]);
    }
  }
};

MQRecv.prototype.init = async function(config) {

  this.ackSave = {};
  this.ackSaveTimerId = {};
  let checkDuplicateMessage = await db.getAllDuplicateMessageCheck();

  checkDuplicateMessage.forEach(({senderId, checkObject}) => {
    this.ackSave[senderId] = checkObject;
    let timerCount = 0;

    for(let msgId in this.ackSave[senderId]) {
      let unixTimeout = this.ackSave[senderId][msgId];
      if(unixTimeout > Date.now()) {
        delete this.ackSave[senderId][msgId];
      }
      else {
        timerCount++;
        if(!this.ackSaveTimerId[senderId]) this.ackSaveTimerId[senderId] = {};
        this.ackSaveTimerId[senderId][msgId] = setTimeout(
          clearAckTimer.bind(this),
          Date.now() - unixTimeout,
          { senderId, msgId },
        );
      }
    }
    //all ack is timeout
    if(timerCount === 0) delete this.ackSave[senderId];
    db.setDuplicateMessageCheck(senderId, this.ackSave[senderId]);
  });

  this.recvSocket.on('message',  async function(jsonMessageStr) {
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
    if(!this.ackSaveTimerId[senderId]) this.ackSaveTimerId[senderId] = {};

    //this message not been received yet
    if(!this.ackSave[senderId][msgId]) {
      this.emit('message', jsonMessage.message);

      let unixTimeout = Date.now() + config.ackSaveTimeout;
      this.ackSave[senderId][msgId] = unixTimeout;
      db.setDuplicateMessageCheck(senderId, this.ackSave[senderId]);

      this.ackSaveTimerId[senderId][msgId] = setTimeout(
        clearAckTimer.bind(this),
        config.ackSaveTimeout,
        { senderId, msgId },
      );
    }

  }.bind(this));
};

util.inherits(MQRecv, EventEmitter);

export default MQRecv;
