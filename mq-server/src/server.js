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

import 'source-map-support/register';

import 'dotenv/config';

import path from 'path';

import grpc from 'grpc';
import * as protoLoader from '@grpc/proto-loader';

import MQSend from './mq_module/mq_send_controller';
import MQRecv from './mq_module/mq_recv_controller';

import errorType from 'ndid-error/type';

import logger from './logger';

import * as config from './config';

const MQ_SEND_TIMEOUT = 60000; // 1 min
const MQ_SEND_TOTAL_TIMEOUT = 600000; // 10 min
const MQ_RECV_MAX_MESSAGE_SIZE = 3300000; // in bytes

let mqSend;
let mqRecv;

const sendACKs = {};

// Load protobuf
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'mq_service.proto'),
  {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);
const proto = grpc.loadPackageDefinition(packageDefinition);

const server = new grpc.Server({
  'grpc.keepalive_time_ms': config.grpcPingInterval,
  'grpc.keepalive_timeout_ms': config.grpcPingTimeout,
  'grpc.keepalive_permit_without_calls': 1,
  'grpc.http2.max_pings_without_data': 0,
  'grpc.http2.min_ping_interval_without_data_ms': config.grpcExpectedClientPingInterval,
  'grpc.http2.min_time_between_pings_ms': config.grpcPingInterval,
});
const SERVER_ADDRESS = `0.0.0.0:${config.serverPort}`;

let recvSubscriberConnections = [];
let sendCalls = {};

// Recv
function subscribeToRecvMessages(call) {
  logger.debug({
    message: 'subscribeToRecvMessages',
  });
  recvSubscriberConnections.push(call);

  call.on('cancelled', () => {
    logger.debug({
      message: 'subscribeToRecvMessages subscriber/client call cancelled',
    });
    recvSubscriberConnections.splice(
      recvSubscriberConnections.indexOf(call),
      1
    );
  });
}

function sendAckForRecvMessage(call, callback) {
  const { message_id: msgId } = call.request;
  logger.debug({
    message: 'sendAckForRecvMessage',
    args: call.request,
  });

  call.on('cancelled', () => {
    logger.debug({
      message: 'sendAckForRecvMessage cancelled',
      msgId,
    });
  });

  if (sendACKs[msgId]) {
    sendACKs[msgId]();
    delete sendACKs[msgId];
    callback(null);
  } else {
    callback({
      code: errorType.MQ_SEND_ACK_UNKNOWN_MESSAGE_ID.code,
      message: errorType.MQ_SEND_ACK_UNKNOWN_MESSAGE_ID.message,
    });
  }
}

function onRecvMessage({ message, msgId, senderId }) {
  if (recvSubscriberConnections.length === 0) {
    logger.warn({
      message: 'Got inbound message but no subscribers/recipients',
      msgId,
      senderId,
    });
  }
  recvSubscriberConnections.forEach((connection) => {
    connection.write({ message, message_id: msgId, sender_id: senderId });
  });
}

function onRecvError({ error }) {
  recvSubscriberConnections.forEach((connection) => {
    connection.write({ error });
  });
}

// Send
function sendMessage(call, callback) {
  const {
    mq_address: mqAddress,
    payload,
    message_id: overriddenMsgId,
  } = call.request;
  const { ip, port } = mqAddress;

  logger.debug({
    message: 'sendMessage',
    args: call.request,
  });

  const msgId = mqSend.send({ ip, port }, payload, null, overriddenMsgId);
  sendCalls[msgId] = { call, callback };

  call.on('cancelled', () => {
    logger.debug({
      message: 'sendMessage cancelled',
      msgId,
    });
    mqSend.stopSend(msgId);
    delete sendCalls[msgId];
  });

  logger.debug({
    message: 'send',
    msgId,
  });
}

function getInfo(call, callback) {
  callback(null, {
    node_id: config.nodeId,
    mq_binding_port: config.mqPort,
  });
}

function initialize() {
  mqSend = new MQSend({
    senderId: config.nodeId,
    timeout: MQ_SEND_TIMEOUT,
    totalTimeout: MQ_SEND_TOTAL_TIMEOUT,
  });
  mqRecv = new MQRecv({
    senderId: config.nodeId,
    port: config.mqPort,
    maxMsgSize: MQ_RECV_MAX_MESSAGE_SIZE,
  });

  mqRecv.on('message', async ({ message, msgId, senderId, sendAck }) => {
    logger.debug({
      message: 'Inbound message',
      msgId,
      senderId,
    });
    sendACKs[msgId] = sendAck;
    onRecvMessage({ message, msgId, senderId });
  });

  mqSend.on('error', (msgId, error) => {
    logger.error(error.getInfoForLog());
    if (sendCalls[msgId]) {
      const { callback } = sendCalls[msgId];
      callback({
        code: error.code,
        message: error.message,
      });
      delete sendCalls[msgId];
    }
  });
  mqSend.on('ack_received', (msgId) => {
    logger.debug({
      message: 'MQ send socket ACK received',
      msgId,
    });
    if (sendCalls[msgId]) {
      const { callback } = sendCalls[msgId];
      callback(null);
      delete sendCalls[msgId];
    }
  });
  mqSend.on('retry_send', (msgId, retryCount) => {
    logger.info({
      message: 'MQ send retry',
      msgId,
      retryCount,
    });
  });

  mqRecv.on('error', (error) => {
    logger.error(error.getInfoForLog());
    onRecvError({ error: { code: error.code, message: error.message } });
  });

  logger.info({
    message: 'Message queue initialized',
  });

  server.addService(proto.MessageQueue.service, {
    subscribeToRecvMessages,
    sendAckForRecvMessage,
    sendMessage,
    getInfo,
  });

  server.bind(SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());

  server.start();

  logger.info({
    message: 'Server initialized',
  });
}

logger.info({
  message: 'Starting server',
  NODE_ENV: process.env.NODE_ENV,
  config,
});

let shutDownCalledOnce = false;
function shutDown() {
  if (shutDownCalledOnce) {
    logger.error({
      message: 'Forcefully shutting down',
    });
    process.exit(1);
  }
  shutDownCalledOnce = true;

  logger.info({
    message: 'Received kill signal, shutting down gracefully',
  });
  server.tryShutdown(() => {
    if (mqRecv) {
      mqRecv.close();
      logger.info({
        message: 'Message queue (recv) socket closed',
      });
    }
    if (mqSend) {
      const socketsClosed = mqSend.closeAll();
      if (socketsClosed > 0) {
        logger.info({
          message: 'Message queue (send) sockets closed',
          socketsClosed,
        });
      }
    }

    logger.info({
      message: 'Shutdown gracefully',
    });
  });
  recvSubscriberConnections.forEach((connection) => {
    connection.end();
  });
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

initialize();
