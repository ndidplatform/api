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
import EventEmitter from 'events';

import grpc from 'grpc';
import * as protoLoader from '@grpc/proto-loader';

import { ExponentialBackoff } from 'simple-backoff';

import { getFunction } from '../functions';

import { wait, randomBase64Bytes } from '../utils';
import logger from '../logger';

import * as config from '../config';

// Load protobuf
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'master_worker.proto'),
  {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);
const proto = grpc.loadPackageDefinition(packageDefinition);
const MASTER_SERVER_ADDRESS = `${config.masterServerIp}:${
  config.masterServerPort
}`;
const workerId = randomBase64Bytes(8);

let client = null;
let connectivityState = null;
let closing = false;
let workerSubscribeChannel = null;

export const eventEmitter = new EventEmitter();

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
            message: 'Worker service gRPC connectivity state watch error',
            err: error,
          });
        } else {
          const newConnectivityState = client
            .getChannel()
            .getConnectivityState();
          logger.debug({
            message: 'Worker service gRPC connectivity state changed',
            connectivityState,
            newConnectivityState,
          });

          // on reconnect (IF watchForNextConnectivityStateChange() this called after first waitForReady)
          if (connectivityState === 1 && newConnectivityState === 2) {
            logger.info({
              message: 'Worker service gRPC reconnect',
              workerId,
            });
            workerSubscribeChannel = client.subscribe({ workerId });
            workerSubscribeChannel.on('data', onRecvData);
          }
          connectivityState = newConnectivityState;
        }
        watchForNextConnectivityStateChange();
      }
    );
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
}

function gRPCRetry(fn) {
  const backoff = new ExponentialBackoff({
    min: 2000,
    max: 10000,
    factor: 2,
    jitter: 0.2,
  });
  let startTime = Date.now();
  let retry = async function() {
    if (Date.now() - startTime < config.workerCallTimeout) {
      try {
        await fn(...arguments);
      } catch (error) {
        await wait(backoff.next());
        await retry(...arguments);
      }
    } else return fn(...arguments); //retry for the last time
  };
  return retry;
}

export async function initialize() {
  client = new proto.MasterWorker(
    MASTER_SERVER_ADDRESS,
    grpc.credentials.createInsecure(),
    {
      'grpc.max_receive_message_length': -1,
    }
  );
  watchForNextConnectivityStateChange();
  await waitForReady(client);
  //client.mqRetry = gRPCRetry(mqRetry);
  client.callbackRetry = gRPCRetry(callbackRetry);
  client.requestTimeout = gRPCRetry(requestTimeout);
  client.cancelTimerJob = gRPCRetry(cancelTimerJob);
}

/*  
  Tell master that we are retrying something.
  If we are lost, master will tell another worker to retry it for us.
*/

/*function mqRetry({
  msgId, 
  deadline, 
  cancel = false, 
  workerId, 
  destination, 
  payload, 
  retryOnServerUnavailable 
}) {
  return new Promise((resolve, reject) => {
    client.mqRetryCall(
      {
        msgId, 
        deadline, 
        cancel, 
        workerId, 
        destination, 
        payload, 
        retryOnServerUnavailable 
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}*/

function callbackRetry({
  cbId,
  deadline,
}) {
  return new Promise((resolve, reject) => {
    client.callbackRetryCall(
      {
        workerId,
        cbId,
        deadline,
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

function cancelTimerJob({
  type,
  jobId,
}) {
  return new Promise((resolve, reject) => {
    client.cancelTimerJobCall(
      {
        type,
        jobId,
        workerId,
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

function requestTimeout({
  requestId,
  deadline
}) {
  return new Promise((resolve, reject) => {
    client.requestTimeoutCall(
      {
        requestId,
        deadline,
        workerId,
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

function returnResult({ grpcRefId, retValStr, error }) {
  logger.debug({
    message: 'Worker return result',
    grpcRefId,
    retValStr,
    err: error,
  });
  return new Promise((resolve, reject) => {
    client.returnResultCall(
      {
        grpcRefId,
        retValStr,
        error,
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function onRecvData(data) {
  const { fnName, args, grpcRefId, metaData } = data;

  logger.debug({
    message: 'Worker received delegated work',
    fnName,
    args,
    grpcRefId,
    metaData,
  });

  try {
    let argArray = JSON.parse(args);
    argArray = argArray.map((arg) => {
      if (arg.type === 'Buffer') {
        return Buffer.from(arg);
      }
      return arg;
    });
    const retVal = await getFunction(fnName)(...argArray);
    let retValStr;
    if (retVal != null) {
      retValStr = JSON.stringify(retVal);
    }
    await gRPCRetry(returnResult)({ grpcRefId, retValStr });
  } catch (error) {
    await gRPCRetry(returnResult)({ grpcRefId, error });
  }

  // switch (fnName) {
  //   case 'handleRetry':
  //     switch(retryType) {
  //       case 'timeoutRequest':
  //         break;
  //       case 'mqSend':
  //         break;
  //       case 'callback':
  //         break;
  //       default:
  //         throw '';
  //     }
  //     return;

  //   default:
  //     logger.debug({
  //       message: 'Worker received unrecognized event from master',
  //       data,
  //     });
  //     return;
  // }
}

export function shutdown() {
  closing = true;
  if (client) {
    if (workerSubscribeChannel) {
      workerSubscribeChannel.cancel();
    }
    client.close();
  }
}

export default function() {
  return client;
}
