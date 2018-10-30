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
const calls = [];

let recvMessageChannel;

const waitPromises = [];
let stopSendMessageRetry = false;

export async function initialize() {
  logger.info({
    message: 'Connecting to MQ service server',
  });
  client = new proto.MessageQueue(
    MQ_SERVICE_SERVER_ADDRESS,
    grpc.credentials.createInsecure()
  );
  await waitForReady(client);
  logger.info({
    message: 'Connected to MQ service server',
  });
}

export function close() {
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

function waitForReady(client) {
  return new Promise((resolve, reject) => {
    client.waitForReady(Infinity, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
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
          return;
        }
        const _errorType = errorType[errorTypeObj[0]];
        reject(
          new CustomError({
            errorType: _errorType,
          })
        );
        return;
      }
      resolve(serverServiceInfo);
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
  recvMessageChannel.on('data', onRecvMessage);
  recvMessageChannel.on('end', async function onRecvMessageChannelEnded() {
    recvMessageChannel.cancel();
    recvMessageChannel = null;
    logger.debug({
      message:
        '[MQ Service] Subscription to receive messages has ended due to server close (stream ended)',
    });
    // Subscribe on reconnect
    try {
      await waitForReady(client);
      subscribeToRecvMessages();
    } catch (error) {}
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
      // Subscribe on reconnect
      try {
        await waitForReady(client);
        subscribeToRecvMessages();
      } catch (error) {}
    }
  });
}

export function sendAckForRecvMessage({ msgId, ackStr }) {
  return new Promise((resolve, reject) => {
    const call = client.sendAckForRecvMessage(
      { 
        message_id: msgId, 
        ackStr 
      },
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
                  ackStr,
                },
                cause: error,
              })
            );
            return;
          }
          const _errorType = errorType[errorTypeObj[0]];
          reject(
            new CustomError({
              errorType: _errorType,
            })
          );
          return;
        }
        resolve();
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
      const { promise, call } = sendMessageInternal(mqAddress, payload, msgId);
      calls.push(call);
      try {
        await promise;
        calls.splice(calls.indexOf(call), 1);
        return;
      } catch (error) {
        calls.splice(calls.indexOf(call), 1);

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
    const { promise, call } = sendMessageInternal(mqAddress, payload, msgId);
    calls.push(call);
    try {
      await promise;
    } catch (error) {
      throw error;
    } finally {
      calls.splice(calls.indexOf(call), 1);
    }
  }
}

export async function cleanUpAfterStoreAck(msgId) {
  return new Promise((resolve, reject) => {
    const call = client.cleanUpAfterStoreAck(
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
                  function: 'cleanUpAfterStoreAck',
                  msgId,
                },
                cause: error,
              })
            );
            return;
          }
          const _errorType = errorType[errorTypeObj[0]];
          reject(
            new CustomError({
              errorType: _errorType,
            })
          );
          return;
        }
        resolve();
      }
    );
    calls.push(call);
  });
}

function sendMessageInternal(mqAddress, payload, msgId) {
  if (client == null) {
    throw new CustomError({
      message: 'gRPC client is not initialized yet',
    });
  }
  let call;
  const promise = new Promise((resolve, reject) => {
    call = client.sendMessage(
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
            return;
          }
          const _errorType = errorType[errorTypeObj[0]];
          reject(
            new CustomError({
              errorType: _errorType,
            })
          );
          return;
        }
        resolve();
      }
    );
  });
  return { promise, call };
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
  if(message.isAck) {
    eventEmitter.emit('ack_received', {
      message: messageBuffer,
      msgId,
      senderId,
    });
  } else {
    eventEmitter.emit('message', {
      message: messageBuffer,
      msgId,
      senderId,
    });
  }
}

