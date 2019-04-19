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

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

export default class MQSend extends EventEmitter {
  constructor(config) {
    super();
    this.totalTimeout = config.totalTimeout || 120000;
    this.timeout = config.timeout || 30000;
    this.id = config.id || '';
    this.callbacksAfterAck = {};

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
      'RetrySend',
      function({ msgId, retryCount }) {
        this.emit('retry_send', msgId, retryCount);
      }.bind(this)
    );

    this.logic.on(
      'PerformTotalTimeout',
      function({ msgId }) {
        this.emit(
          'error',
          msgId,
          new CustomError({
            errorType: errorType.MQ_SEND_TIMEOUT,
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
            errorType: errorType.MQ_SEND_ERROR,
            cause: error,
          })
        );
      }.bind(this)
    );

    this.socket.on(
      'message',
      function(messageBuffer) {
        const msg = MQProtocol.extractMsg(messageBuffer);
        const { msgId, seqId } = msg.retryspec;
        this.emit('debug', 'Received ACK for ' + msgId + '/' + seqId);
        this.logic.cleanUp(msgId);
        if (this.callbacksAfterAck[msgId]) {
          this.callbacksAfterAck[msgId]();
          delete this.callbacksAfterAck[msgId];
        }
        this.emit('ack_received', msgId);
      }.bind(this)
    );

    this.socket.on('new_socket_connection', (count) =>
      this.emit('new_socket_connection', count)
    );
    this.socket.on('socket_connection_closed', (count) =>
      this.emit('socket_connection_closed', count)
    );
  }

  _cleanUp(msgId, seqId) {
    try {
      this.socket.cleanUp(msgId, seqId);
    } catch (error) {
      this.emit(
        'error',
        new CustomError({
          errorType: errorType.MQ_SEND_CLEANUP_ERROR,
          cause: error,
        })
      );
    }
  }

  send(dest, payload, msgId, callbackAfterAck) {
    if (!msgId) {
      throw new Error('Missing "msgId"');
    }
    if (msgId && typeof msgId !== 'string') {
      throw new Error('"msgId" must be a string');
    }
    if (callbackAfterAck) {
      if (typeof callbackAfterAck !== 'function') {
        throw new Error('"callbackAfterAck" must be a function');
      }
      this.callbacksAfterAck[msgId] = callbackAfterAck;
    }
    // let the logic to dictate when\where it should send
    this.logic.send(dest, payload, msgId);
  }

  stopSend(msgId) {
    this.logic.cleanUp(msgId);
  }

  closeAll() {
    this.logic.stopAllRetries();
    return this.socket.closeAll();
  }
}
