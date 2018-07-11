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
import MQProtocol from './mqprotocol.js';
import MQLogic    from './mqlogic.js';
import MQSendSocket from './mqsendsocket.js';
import CustomError from '../error/customError';

let protocol = new MQProtocol();

class MQSend extends EventEmitter {
  constructor(config) {
    super();
    this.totalTimeout = config.totalTimeout || 120000;
    this.timeout = config.timeout || 30000;
    this.id = config.id || '';

    this.logic = new MQLogic({
      totalTimeout: this.totalTimeout,
      timeout: this.timeout
    });

    this.logic.on('PerformSend', function (params) {
      let message = protocol.GenerateSendMsg(
        params.payload, {
          msgId: params.msgId,
          seqId: params.seqId,
          senderId: this.id,
      });
      this.emit('debug', this.id + ': sending msg' + params.msgId);

      this.socket.send(params.dest, message, params.seqId);
    }.bind(this));

    this.logic.on('PerformCleanUp',function (seqId) {
      this._cleanUp(seqId);
    }.bind(this));

    this.logic.on('PerformTotalTimeout', function (msgId) {
      this.emit('error', new CustomError({
        code:'MQERR_TIMEOUT', 
        message: this.id + ': Too many retries. Giving up.'
      }));
    }.bind(this));

    this.socket = new MQSendSocket();

    this.socket.on('error', function(err) {
      this.emit('error', err);
    }.bind(this));

    this.socket.on('message', function(jsonMessageStr) {
      const msg = protocol.ExtractMsg(jsonMessageStr);
      this.emit('debug', 'Received ACK for ' + msg.retryspec.msgId + '/' + msg.retryspec.seqId);
      this.logic.AckReceived(msg.retryspec.msgId);
    }.bind(this));
  }

  _cleanUp(seqId){
    try {
      this.socket.cleanUp(seqId);
    } catch (error) {
      this.emit('error', new CustomError({code:'MQERR_CLEANUPERR', message:error}));
    }
  }

  send(dest, payload ) {
    // let the logic to dictate when\where it should send
    this.logic.Send(dest, payload);
  }
}

export default MQSend;
