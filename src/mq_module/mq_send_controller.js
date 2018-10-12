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

import * as MQProtocol from './mq_protocol';
import MQLogic from './mq_logic';
import MQSendSocket from './mq_send_socket';

import CustomError from '../error/custom_error';
import errorTypes from '../error/type';

export default class MQSend extends EventEmitter {
  constructor(config) {
    super();
    this.totalTimeout = config.totalTimeout || 120000;
    this.timeout = config.timeout || 30000;
    this.id = config.id || '';

    this.logic = new MQLogic({
      totalTimeout: this.totalTimeout,
      timeout: this.timeout,
    });

    this.logic.on(
      'PerformSend',
      function(params) {
        const message = MQProtocol.generateSendMsg(
          config.senderId,
          params.payload,
          {
            msgId: params.msgId,
            seqId: params.seqId,
          }
        );

        this.emit('debug', this.id + ': sending msg' + params.msgId);
        this.socket.send(params.dest, message, params.msgId, params.seqId);
      }.bind(this)
    );

    this.logic.on(
      'PerformCleanUp',
      function(msgId, seqId) {
        this._cleanUp(msgId, seqId);
      }.bind(this)
    );

    this.logic.on(
      'PerformTotalTimeout',
      function({ msgId }) {
        this.emit(
          'error',
          msgId,
          new CustomError({
            errorType: errorTypes.MQ_SEND_TIMEOUT,
            details: {
              id: this.id,
              msgId,
            },
          })
        );
      }.bind(this)
    );

    this.socket = new MQSendSocket();

    this.socket.on(
      'error',
      function(msgId, error) {
        this.emit(
          'error',
          msgId,
          new CustomError({
            errorType: errorTypes.MQ_SEND_ERROR,
            cause: error,
          })
        );
      }.bind(this)
    );

    this.socket.on(
      'message',
      function(messageBuffer) {
        const msg = MQProtocol.extractMsg(messageBuffer);
        this.emit(
          'debug',
          'Received ACK for ' + msg.retryspec.msgId + '/' + msg.retryspec.seqId
        );
        this.logic.cleanUp(msg.retryspec.msgId);
        this.emit('ack_received', msg.retryspec.msgId);
      }.bind(this)
    );
  }

  _cleanUp(msgId, seqId) {
    try {
      this.socket.cleanUp(seqId);
    } catch (error) {
      this.emit(
        'error',
        new CustomError({
          code: 'MQERR_CLEANUPERR',
          message: 'Message queue clean up error',
          cause: error,
        })
      );
    }
  }

  send(dest, payload, callbackAfterAck, msgId) {
    // let the logic to dictate when\where it should send
    return this.logic.send(dest, payload, callbackAfterAck, msgId);
  }

  stopSend(msgId) {
    this.logic.cleanUp(msgId);
  }

  closeAll() {
    this.logic.stopAllRetries();
    return this.socket.closeAll();
  }
}
