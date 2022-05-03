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

import path from 'path';
import EventEmitter from 'events';

import * as grpc from 'grpc';
import * as protoLoader from '@grpc/proto-loader';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import { readFileAsync } from '../utils';

import logger from '../logger';

import * as config from '../config';

// Load protobuf
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'mq_recv_service.proto'),
  {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);
const proto = grpc.loadPackageDefinition(packageDefinition);

export const eventEmitter = new EventEmitter();

const server = new grpc.Server({
  'grpc.keepalive_time_ms': config.grpcPingInterval,
  'grpc.keepalive_timeout_ms': config.grpcPingTimeout,
  'grpc.keepalive_permit_without_calls': 1,
  'grpc.http2.max_pings_without_data': 0,
  'grpc.http2.min_ping_interval_without_data_ms':
    config.grpcExpectedClientPingInterval,
  'grpc.http2.min_time_between_pings_ms': config.grpcPingInterval,
});
const SERVER_ADDRESS = `0.0.0.0:${config.mqRecvGrpcServerPort}`;

function recvMessage(call, callback) {
  const { message_id: msgId } = call.request;

  logger.debug({
    message: 'recvMessage',
    args: call.request,
  });

  call.on('cancelled', () => {
    logger.debug({
      message: 'recvMessage cancelled',
      msgId,
    });
  });

  onRecvMessage(call.request);

  callback(null);

  // metricsEventEmitter.emit('recv_message');
}

function onRecvMessage(message) {
  const {
    message: messageBuffer,
    message_id: msgId,
    sender_id: senderId,
    error,
  } = message;
  if (error) {
    const errorTypeObj = Object.entries(errorType).find(([key, value]) => {
      return value.code === error.code;
    });
    if (errorTypeObj == null) {
      eventEmitter.emit(
        'error',
        new CustomError({
          errorType: errorType.UNKNOWN_ERROR,
          details: {
            module: 'mq_service',
            function: 'onRecvMessage',
          },
          cause: error,
        })
      );
      return;
    }
    const _errorType = errorType[errorTypeObj[0]];
    eventEmitter.emit(
      'error',
      new CustomError({
        errorType: _errorType,
      })
    );
    return;
  }
  eventEmitter.emit('message', {
    message: messageBuffer,
    msgId,
    senderId,
  });
}

function getInfo(call, callback) {
  callback(null, {
    node_id: config.nodeId,
    mq_binding_port: config.mqPort,
    // version,
  });
}

export async function initialize() {
  let grpcSslRootCert;
  let grpcSslKey;
  let grpcSslCert;
  if (config.grpcSsl) {
    grpcSslRootCert = await readFileAsync(config.grpcSslRootCertFilePath);
    grpcSslKey = await readFileAsync(config.grpcSslKeyFilePath);
    grpcSslCert = await readFileAsync(config.grpcSslCertFilePath);
  }

  server.addService(proto.MessageQueueReceiver.service, {
    recvMessage,
    getInfo,
  });

  const port = server.bind(
    SERVER_ADDRESS,
    config.grpcSsl
      ? grpc.ServerCredentials.createSsl(grpcSslRootCert, [
          {
            cert_chain: grpcSslCert,
            private_key: grpcSslKey,
          },
        ])
      : grpc.ServerCredentials.createInsecure()
  );

  server.start();

  logger.info({
    message: 'MQ recv server initialized',
    grpcPort: port,
  });
}
