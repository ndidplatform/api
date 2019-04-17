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

import { getArgsFromProtobuf } from './message';

import { getPendingRequestTimeout } from '../core/common';
import { getPendingCallback } from '../callback';
import { getPendingOutboundMessageMsgIds } from '../mq';

import { getFunction } from '../functions';

import { wait, randomBase64Bytes, readFileAsync } from '../utils';
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
let knownMasterId;

let client = null;
let connectivityState = null;
let closing = false;
let workerSubscribeChannel = null;

let workingJobCount = 0;

const eventEmitter = new EventEmitter();

export const metricsEventEmitter = new EventEmitter();

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
            message: 'Master process gRPC connectivity state watch error',
            err: error,
          });
        } else {
          const newConnectivityState = client
            .getChannel()
            .getConnectivityState();
          logger.debug({
            message: 'Master process gRPC connectivity state changed',
            connectivityState,
            newConnectivityState,
          });

          // on reconnect (IF watchForNextConnectivityStateChange() this called after first waitForReady)
          if (connectivityState === 1 && newConnectivityState === 2) {
            logger.info({
              message: 'Master process gRPC reconnect',
            });
            await checkMasterId();
            subscribe();
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

function gRPCRetry(fn, timeout = config.callToMasterRetryTimeout) {
  const backoff = new ExponentialBackoff({
    min: 2000,
    max: 10000,
    factor: 2,
    jitter: 0.2,
  });
  const startTime = Date.now();
  const retry = async function() {
    if (Date.now() - startTime < timeout) {
      try {
        await fn(...arguments);
      } catch (error) {
        await wait(backoff.next());
        await retry(...arguments);
      }
    } else {
      //retry for the last time
      return fn(...arguments);
    }
  };
  return retry;
}

export async function initialize() {
  logger.info({
    message: 'Connecting to master process',
    workerId,
  });
  let grpcSslRootCert;
  let grpcSslKey;
  let grpcSslCert;
  if (config.grpcSsl) {
    grpcSslRootCert = await readFileAsync(config.grpcSslRootCertFilePath);
    grpcSslKey = await readFileAsync(config.grpcSslKeyFilePath);
    grpcSslCert = await readFileAsync(config.grpcSslCertFilePath);
  }
  client = new proto.MasterWorker(
    MASTER_SERVER_ADDRESS,
    config.grpcSsl
      ? grpc.credentials.createSsl(grpcSslRootCert, grpcSslKey, grpcSslCert)
      : grpc.credentials.createInsecure(),
    {
      'grpc.keepalive_time_ms': config.grpcPingInterval,
      'grpc.keepalive_timeout_ms': config.grpcPingTimeout,
      'grpc.keepalive_permit_without_calls': 1,
      'grpc.http2.max_pings_without_data': 0,
      'grpc.http2.min_time_between_pings_ms': config.grpcPingInterval,
      'grpc.max_receive_message_length': -1,
    }
  );
  await waitForReady(client);
  await checkMasterId();
  subscribe();
  watchForNextConnectivityStateChange();
  logger.info({
    message: 'Connected to master process',
  });
}

async function checkMasterId() {
  const masterId = await getMasterId();
  if (knownMasterId != null && knownMasterId !== masterId) {
    // TODO: clear everything as if process is restarted
  }
  knownMasterId = masterId;
  logger.info({
    message: 'Master ID',
    masterId: knownMasterId,
  });
}

function getMasterId() {
  return new Promise((resolve, reject) => {
    client.getMasterId({ workerId }, (error, { masterId }) => {
      if (error) reject(error);
      else resolve(masterId);
    });
  });
}

function subscribe() {
  workerSubscribeChannel = client.subscribe({ workerId });
  workerSubscribeChannel.on('data', onRecvData);
}

function workerStopping() {
  return new Promise((resolve, reject) => {
    client.workerStoppingCall({ workerId }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function returnResult({ grpcRefId, retVal, error }) {
  logger.debug({
    message: 'Worker return result',
    grpcRefId,
    retVal,
    err: error,
  });
  let retValStr;
  if (retVal != null) {
    retValStr = JSON.stringify(retVal);
  }
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

export function externalCryptoServiceCallbackUrlsSet() {
  return gRPCRetry(externalCryptoServiceCallbackUrlsSetInternal)();
}

function externalCryptoServiceCallbackUrlsSetInternal() {
  logger.debug({
    message: 'Signaling external crypto service callback URLs set to master',
  });
  return new Promise((resolve, reject) => {
    client.externalCryptoServiceCallbackUrlsSet(
      {
        workerId,
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

export function broadcastRemoveRequestTimeoutScheduler({ nodeId, requestId }) {
  return gRPCRetry(broadcastRemoveRequestTimeoutSchedulerInternal)({
    nodeId,
    requestId,
  });
}

function broadcastRemoveRequestTimeoutSchedulerInternal({ nodeId, requestId }) {
  logger.debug({
    message:
      'Sending remove request timeout scheduler broadcast request to master',
    nodeId,
    requestId,
  });
  return new Promise((resolve, reject) => {
    client.removeRequestTimeoutScheduler(
      {
        workerId,
        nodeId,
        requestId,
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function onRecvData(data) {
  const { fnName, args, grpcRefId, eventName } = data;

  if (eventName === 'master_shuting_down') {
    handleMasterShutdown();
    return;
  }

  logger.debug({
    message: 'Worker received call from master',
    fnName,
    args,
    grpcRefId,
  });

  incrementWorkingJobCount();
  try {
    const parsedArgs = getArgsFromProtobuf(fnName, args);
    let retVal;
    if (Array.isArray(parsedArgs)) {
      retVal = await getFunction(fnName)(...parsedArgs);
    } else {
      retVal = await getFunction(fnName)(parsedArgs);
    }
    await gRPCRetry(returnResult)({ grpcRefId, retVal });
  } catch (error) {
    await gRPCRetry(returnResult)({ grpcRefId, error });
  }
  decrementWorkingJobCount();
}

function waitForAllJobDone() {
  if (workingJobCount > 0) {
    logger.info({
      message: 'Waiting for jobs to finish',
      workingJobCount,
    });
    return new Promise((resolve) =>
      eventEmitter.once('all_jobs_cleared', () => resolve())
    );
  }
}

/*  
  Tell master that we are retrying something.
  If we are lost, master will tell another worker to retry it for us.
*/

function handleShutdownTimerJobs(jobsDetail) {
  return gRPCRetry(() => {
    return new Promise((resolve, reject) => {
      client.tasksBeforeShutdown(
        {
          jobsDetail: JSON.stringify(jobsDetail),
          workerId,
        },
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
    });
  })();
}

function handleMasterShutdown() {
  logger.info({
    message: 'Received master shutdown',
    masterId: knownMasterId,
  });
  // TODO: clear everything as if process is restarted

  knownMasterId = null;
}

export async function shutdown() {
  logger.info({
    message: 'Shutting down worker',
    workerId,
  });
  if (client) {
    if (knownMasterId != null) {
      await gRPCRetry(workerStopping)();
    }
    closing = true;
    await waitForAllJobDone();
    if (knownMasterId != null) {
      const pendingTasks = [
        {
          type: 'requestTimeout',
          tasks: getPendingRequestTimeout(),
        },
        {
          type: 'callback',
          tasks: getPendingCallback(),
        },
        {
          type: 'mq',
          tasks: getPendingOutboundMessageMsgIds(),
        },
      ];
      await handleShutdownTimerJobs(pendingTasks);
    }
    if (workerSubscribeChannel) {
      workerSubscribeChannel.on('error', () => {
        //handle to suppress error log
        workerSubscribeChannel = null;
      });
      workerSubscribeChannel.cancel();
    }
    client.close();
  }
  logger.info({
    message: 'Worker shutdown successfully',
    workerId,
  });
}

function incrementWorkingJobCount() {
  workingJobCount++;
  metricsEventEmitter.emit('workingJobCount', workingJobCount);
}

function decrementWorkingJobCount() {
  workingJobCount--;
  metricsEventEmitter.emit('workingJobCount', workingJobCount);
  if (workingJobCount === 0) {
    eventEmitter.emit('all_jobs_cleared');
  }
}
