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

import path from 'path';
import { EventEmitter } from 'events';

import grpc from 'grpc';
import * as protoLoader from '@grpc/proto-loader';
import { ExponentialBackoff } from 'simple-backoff';

import { wait } from '../utils';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import logger from '../logger';

import * as config from '../config';

// Load protobuf
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'mq_service.proto'),
  {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);
const proto = grpc.loadPackageDefinition(packageDefinition);

const MQ_SERVICE_SERVER_ADDRESS = `${config.mqServiceServerIp}:${
  config.mqServiceServerPort
}`;

export const eventEmitter = new EventEmitter();

let client;
let connectivityState = null;
let closing = false;
const calls = [];
let nodeIdMatched;

let recvMessageChannel;

const waitPromises = [];
let stopSendMessageRetry = false;

let subscribedToRecvMessages = false;

function watchForNextConnectivityStateChange() {
  if (client == null) {
    throw new Error('client is not initialized');
  }
  client
    .getChannel()
    .watchConnectivityState(
      client.getChannel().getConnectivityState(true),
      Infinity,
      async (error) => {
        if (closing) return;
        if (error) {
          logger.error({
            message: 'MQ service gRPC connectivity state watch error',
            error,
          });
        } else {
          const newConnectivityState = client
            .getChannel()
            .getConnectivityState();
          logger.debug({
            message: 'MQ service gRPC connectivity state changed',
            connectivityState,
            newConnectivityState,
          });

          // on reconnect (IF watchForNextConnectivityStateChange() this called after first waitForReady)
          if (connectivityState === 1 && newConnectivityState === 2) {
            logger.info({
              message: 'MQ service gRPC reconnect',
            });
            try {
              await checkNodeIdToMatch();
            } catch (error) {
              const err = new CustomError({
                message: 'Node ID check failed on reconnect',
                cause: error,
              });
              logger.error(err.getInfoForLog());
            }
            if (nodeIdMatched) {
              if (subscribedToRecvMessages) {
                // Subscribe on reconnect if previously subscribed
                subscribeToRecvMessages();
              }
            }
          }

          connectivityState = newConnectivityState;
        }
        watchForNextConnectivityStateChange();
      }
    );
}

export async function initialize() {
  logger.info({
    message: 'Connecting to MQ service server',
  });
  client = new proto.MessageQueue(
    MQ_SERVICE_SERVER_ADDRESS,
    grpc.credentials.createInsecure(),
    {
      'grpc.keepalive_time_ms': config.grpcPingInterval,
      'grpc.keepalive_timeout_ms': config.grpcPingTimeout,
      // 'grpc.keepalive_permit_without_calls': 1,
      'grpc.http2.max_pings_without_data': 0,
      'grpc.http2.min_time_between_pings_ms': config.grpcPingInterval,
    }
  );
  await waitForReady(client);
  await checkNodeIdToMatch();
  watchForNextConnectivityStateChange();
  logger.info({
    message: 'Connected to MQ service server',
  });
}

async function checkNodeIdToMatch() {
  logger.info({
    message: 'Checking Node ID setting on MQ service server',
  });
  const mqServiceServerInfo = await getInfo();
  if (mqServiceServerInfo.node_id !== config.nodeId) {
    nodeIdMatched = false;
    throw new CustomError({
      message: 'MQ service server Node ID mismatch',
      apiServerNodeId: config.nodeId,
      mqServerNodeId: mqServiceServerInfo.node_id,
    });
  }
  nodeIdMatched = true;
  logger.info({
    message: 'Node ID matched',
  });
}

export function close() {
  closing = true;
  stopSendMessageRetry = true;
  waitPromises.forEach((waitPromise) => waitPromise.stop());
  if (client) {
    if (recvMessageChannel) {
      recvMessageChannel.cancel();
    }
    calls.forEach((call) => call.cancel());
    client.close();
    logger.info({
      message: 'Closed connection to MQ service server',
    });
  }
}

async function waitForReady(client) {
  await new Promise((resolve, reject) => {
    client.waitForReady(Infinity, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  logger.info({
    message: 'MQ service server ready',
  });
}

export function getInfo() {
  if (client == null) {
    throw new CustomError({
      message: 'gRPC client is not initialized yet',
    });
  }
  return new Promise((resolve, reject) => {
    const call = client.getInfo(null, (error, serverServiceInfo) => {
      if (error) {
        const errorTypeObj = Object.entries(errorType).find(([key, value]) => {
          return value.code === error.code;
        });
        if (errorTypeObj == null) {
          reject(
            new CustomError({
              errorType: errorType.UNKNOWN_ERROR,
              details: {
                module: 'mq_service',
                function: 'getInfo',
              },
              cause: error,
            })
          );
          calls.splice(calls.indexOf(call), 1);
          return;
        }
        const _errorType = errorType[errorTypeObj[0]];
        reject(
          new CustomError({
            errorType: _errorType,
          })
        );
        calls.splice(calls.indexOf(call), 1);
        return;
      }
      resolve(serverServiceInfo);
      calls.splice(calls.indexOf(call), 1);
    });
    calls.push(call);
  });
}

export function subscribeToRecvMessages() {
  if (client == null) {
    throw new CustomError({
      message: 'gRPC client is not initialized yet',
    });
  }
  if (recvMessageChannel != null) return;
  recvMessageChannel = client.subscribeToRecvMessages(null);
  subscribedToRecvMessages = true;
  recvMessageChannel.on('data', onRecvMessage);
  recvMessageChannel.on('end', async function onRecvMessageChannelEnded() {
    recvMessageChannel.cancel();
    recvMessageChannel = null;
    logger.debug({
      message:
        '[MQ Service] Subscription to receive messages has ended due to server close (stream ended)',
    });
  });
  recvMessageChannel.on('error', async function onRecvMessageChannelError(
    error
  ) {
    if (error.code !== grpc.status.CANCELLED) {
      const err = new CustomError({
        message: 'Receive Message channel error',
        cause: error,
      });
      logger.error(err.getInfoForLog());
      recvMessageChannel.cancel();
      recvMessageChannel = null;
      logger.debug({
        message:
          '[MQ Service] Subscription to receive messages has ended due to error',
      });
    }
  });
}

export function sendAckForRecvMessage(msgId) {
  if (!nodeIdMatched) {
    throw new Error('Node ID mismatch. Will NOT send');
  }
  return new Promise((resolve, reject) => {
    const call = client.sendAckForRecvMessage(
      { message_id: msgId },
      (error) => {
        if (error) {
          const errorTypeObj = Object.entries(errorType).find(
            ([key, value]) => {
              return value.code === error.code;
            }
          );
          if (errorTypeObj == null) {
            reject(
              new CustomError({
                errorType: errorType.UNKNOWN_ERROR,
                details: {
                  module: 'mq_service',
                  function: 'sendAckForRecvMessage',
                  msgId,
                },
                cause: error,
              })
            );
            calls.splice(calls.indexOf(call), 1);
            return;
          }
          const _errorType = errorType[errorTypeObj[0]];
          reject(
            new CustomError({
              errorType: _errorType,
            })
          );
          calls.splice(calls.indexOf(call), 1);
          return;
        }
        resolve();
        calls.splice(calls.indexOf(call), 1);
      }
    );
    calls.push(call);
  });
}

export async function sendMessage(
  mqAddress,
  payload,
  msgId,
  retryOnServerUnavailable,
  retryDuration
) {
  if (!nodeIdMatched) {
    throw new Error('Node ID mismatch. Will NOT send');
  }
  if (retryOnServerUnavailable) {
    const backoff = new ExponentialBackoff({
      min: 5000,
      max: 180000,
      factor: 2,
      jitter: 0.2,
    });

    const startTime = Date.now();

    for (;;) {
      if (stopSendMessageRetry) return;
      try {
        await sendMessageInternal(mqAddress, payload, msgId);
        return;
      } catch (error) {
        logger.error(error.getInfoForLog());

        if (error.cause && error.cause.code === grpc.status.CANCELLED) {
          throw error;
        }

        const nextRetry = backoff.next();

        if (retryDuration) {
          if (Date.now() - startTime + nextRetry > retryDuration) {
            logger.warn({
              message: '[MQ Service] Send message retry timed out',
            });
            return;
          }
        }

        const waitPromise = wait(nextRetry, true);
        waitPromises.push(waitPromise);
        await waitPromise;
        waitPromises.splice(waitPromises.indexOf(waitPromise), 1);
      }
    }
  } else {
    try {
      await sendMessageInternal(mqAddress, payload, msgId);
    } catch (error) {
      throw error;
    }
  }
}

function sendMessageInternal(mqAddress, payload, msgId) {
  if (client == null) {
    throw new CustomError({
      message: 'gRPC client is not initialized yet',
    });
  }
  return new Promise((resolve, reject) => {
    const call = client.sendMessage(
      { mq_address: mqAddress, payload, message_id: msgId },
      (error) => {
        if (error) {
          const errorTypeObj = Object.entries(errorType).find(
            ([key, value]) => {
              return value.code === error.code;
            }
          );
          if (errorTypeObj == null) {
            reject(
              new CustomError({
                errorType: errorType.UNKNOWN_ERROR,
                details: {
                  module: 'mq_service',
                  function: 'sendMessage',
                  arguments: arguments,
                },
                cause: error,
              })
            );
            calls.splice(calls.indexOf(call), 1);
            return;
          }
          const _errorType = errorType[errorTypeObj[0]];
          reject(
            new CustomError({
              errorType: _errorType,
            })
          );
          calls.splice(calls.indexOf(call), 1);
          return;
        }
        resolve();
        calls.splice(calls.indexOf(call), 1);
      }
    );
    calls.push(call);
  });
}

//When server send a message
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
