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

import { getArgsProtobuf } from './message';

import { getFunction } from '../functions';

import { randomBase64Bytes } from '../utils';
import CustomError from 'ndid-error/custom_error';
import logger from '../logger';

import * as config from '../config';

const masterId = randomBase64Bytes(8);

let server;
let stoppingWorkerCount = 0;

const workerList = [];
const workerLostHandling = {};
const lostWorkerIdsToHandle = [];

export const eventEmitter = new EventEmitter();

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

const grpcCallRefIdPrefix = randomBase64Bytes(8);
let grpcCallRefIdCounter = 0;

const grpcCall = {};

export function initialize() {
  server = new grpc.Server({
    'grpc.keepalive_time_ms': config.grpcPingInterval,
    'grpc.keepalive_timeout_ms': config.grpcPingTimeout,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_ping_interval_without_data_ms':
      config.grpcExpectedClientPingInterval,
    'grpc.http2.min_time_between_pings_ms': config.grpcPingInterval,
    'grpc.max_receive_message_length': -1,
  });
  const MASTER_SERVER_ADDRESS = `0.0.0.0:${config.masterServerPort}`;

  server.addService(proto.MasterWorker.service, {
    getMasterId,
    subscribe,
    tasksBeforeShutdown,
    returnResultCall,
    externalCryptoServiceCallbackUrlsSet,
    removeRequestTimeoutScheduler,
    workerStoppingCall,
  });

  server.bind(MASTER_SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());
  server.start();

  logger.info({
    message: 'Master gRPC server initialzed',
    masterId,
  });
}

function getMasterId(call, callback) {
  const { workerId } = call.request;
  logger.debug({ message: 'Get master ID', workerId });
  callback(null, { masterId });
}

function subscribe(call) {
  logger.info({
    message: 'New worker connected',
  });
  const { workerId } = call.request;

  if (workerList.find((worker) => worker.workerId === workerId) != null) {
    //duplicate workerId
    call.end();
    return;
  }

  workerList.push({
    connection: call,
    workerId,
    jobCount: 0,
    stopping: false,
  });

  call.on('cancelled', () => {
    for (let i = 0; i < workerList.length; i++) {
      if (workerList[i].workerId === workerId) {
        if (workerList[i].stopping) {
          stoppingWorkerCount--;
        }
        workerList.splice(i, 1);
      }
    }
    handleWorkerLost(workerId);
  });

  lostWorkerIdsToHandle.forEach(handleLostWorkerRemainingTasks);

  eventEmitter.emit('worker_connected', workerId);
}

function handleRequestTimeoutWorkerLost(workerId) {
  const requestTimeout = workerLostHandling[workerId].find(
    ({ type }) => type === 'requestTimeout'
  );
  const requestTimeoutTask = requestTimeout.tasks;
  for (let requestId in requestTimeoutTask) {
    const { deadline } = requestTimeoutTask[requestId];
    if (Date.now() < deadline) {
      delegateToWorker({
        fnName: 'common.runTimeoutScheduler',
        args: [config.nodeId, requestId, deadline],
      });
    }
  }
}

function handleCallbackRetryWorkerLost(workerId) {
  const callback = workerLostHandling[workerId].find(
    ({ type }) => type === 'callback'
  );
  const callbackTask = callback.tasks;
  for (let cbId in callbackTask) {
    const { deadline } = callbackTask[cbId];
    if (Date.now() < deadline) {
      delegateToWorker({
        fnName: 'callback.continueCallbackWithRetry',
        args: [cbId, deadline],
      });
    }
  }
}

function handleMqRetryWorkerLost(workerId) {
  const mq = workerLostHandling[workerId].find(({ type }) => type === 'mq');
  mq.tasks.forEach((msgId) =>
    delegateToWorker({
      fnName: 'mq.resumePendingOutboundMessageSendOnWorker',
      args: [msgId],
    })
  );
}

function handleWorkerLost(workerId) {
  const remainingTasksAvailable = workerLostHandling[workerId] != null;
  logger.info({
    message: 'Worker lost',
    workerId,
    remainingTasksAvailable,
  });
  if (remainingTasksAvailable) {
    // No worker available, hold off until available
    if (workerList.length === 0 || workerList.length === stoppingWorkerCount) {
      lostWorkerIdsToHandle.push(workerId);
    } else {
      handleLostWorkerRemainingTasks(workerId);
    }
  } else {
    logger.warn({
      message: 'Worker lost without signaling first',
      workerId,
    });
  }
}

function handleLostWorkerRemainingTasks(workerId) {
  logger.debug({
    message: 'Handle lost worker remaining tasks',
    workerId,
    tasks: workerLostHandling[workerId],
  });
  handleRequestTimeoutWorkerLost(workerId);
  handleCallbackRetryWorkerLost(workerId);
  handleMqRetryWorkerLost(workerId);
  delete workerLostHandling[workerId];
  lostWorkerIdsToHandle.splice(lostWorkerIdsToHandle.indexOf(workerId), 1);
}

function workerStoppingCall(call, done) {
  const { workerId } = call.request;
  const worker = workerList.find((worker) => worker.workerId === workerId);
  if (worker != null) {
    if (!worker.stopping) {
      stoppingWorkerCount++;
    }
    worker.stopping = true;
  }
  done();
}

function tasksBeforeShutdown(call, done) {
  let { jobsDetail, workerId } = call.request;
  jobsDetail = JSON.parse(jobsDetail);
  logger.debug({
    message: 'Received worker remaining tasks before worker shutdown',
    workerId,
    tasks: jobsDetail,
  });
  workerLostHandling[workerId] = jobsDetail;
  done();
}

function returnResultCall(call, done) {
  const { grpcRefId, retValStr, error } = call.request;
  if (grpcCall[grpcRefId]) {
    const { callback, additionalCallbackArgs, worker } = grpcCall[grpcRefId];
    if (callback) {
      let retVal;
      if (retValStr) {
        retVal = JSON.parse(retValStr);
        retVal = retVal.map((val) => {
          if (val.type === 'Buffer') {
            return Buffer.from(val);
          }
          return val;
        });
      }
      callback(error, retVal, additionalCallbackArgs);
    } else {
      if (error) {
        logger.error({ err: error });
      }
    }
    worker.jobCount--;
    delete grpcCall[grpcRefId];
  } else {
    const error = new CustomError({
      message: 'Unknown gRPC call ref ID',
      details: {
        grpcRefId,
      },
    });
    logger.error({ err: error });
  }
  done();
}

async function externalCryptoServiceCallbackUrlsSet(call, done) {
  const { workerId } = call.request;
  await getFunction('externalCryptoService.checkAndEmitAllCallbacksSet')();
  remoteFnCallToWorkers({
    fnName: 'externalCryptoService.checkAndEmitAllCallbacksSet',
    excludedWorkerIds: [workerId],
  });
  done();
}

function removeRequestTimeoutScheduler(call, done) {
  const { workerId, nodeId, requestId } = call.request;
  remoteFnCallToWorkers({
    fnName: 'common.removeTimeoutSchedulerInternal',
    args: [nodeId, requestId],
    excludedWorkerIds: [workerId],
  });
  done();
}

function getWorker(specificWorkerId) {
  if (workerList.length === 0 || workerList.length === stoppingWorkerCount) {
    throw new Error('No worker available');
  }

  if (!specificWorkerId) {
    // Round-robin
    // counter = (counter + 1) % workerList.length;
    // const index = counter;

    // Least job count
    let min = Infinity;
    let index = -1;
    for (let i = 0; i < workerList.length; i++) {
      if (workerList[i].jobCount < min && !workerList[i].stopping) {
        min = workerList[i].jobCount;
        index = i;
      }
    }
    return workerList[index];
  } else {
    for (let i = 0; i < workerList.length; i++) {
      if (workerList[i].workerId === specificWorkerId) {
        return workerList[i];
      }
    }
    throw new Error('Worker not found');
  }
}

export function delegateToWorker({
  fnName,
  args,
  callback,
  additionalCallbackArgs,
  specificWorkerId,
}) {
  const grpcRefId = `${grpcCallRefIdPrefix}-${grpcCallRefIdCounter++}`;

  logger.debug({
    message: 'Master delegate job to worker',
    fnName,
    args,
    specificWorkerId,
    grpcRefId,
  });

  const worker = getWorker(specificWorkerId);

  grpcCall[grpcRefId] = { fnName, callback, additionalCallbackArgs, worker };

  worker.jobCount++;

  logger.debug({
    message: 'Sending job to worker',
    grpcRefId,
    workerId: worker.workerId,
    workerJobCount: worker.jobCount,
  });

  const argsProtobuf = getArgsProtobuf(fnName, args);

  worker.connection.write({
    fnName,
    grpcRefId,
    args: argsProtobuf,
  });
}

export function remoteFnCallToWorkers({
  fnName,
  args,
  callback,
  additionalCallbackArgs,
  excludedWorkerIds,
}) {
  logger.debug({
    message: 'Master remote function call to multiple workers',
    fnName,
    args,
    excludedWorkerIds,
  });

  const argsProtobuf = getArgsProtobuf(fnName, args);

  workerList.forEach((worker) => {
    if (
      worker.stopping ||
      (excludedWorkerIds != null && excludedWorkerIds.includes(worker.workerId))
    ) {
      return;
    }

    const grpcRefId = `${grpcCallRefIdPrefix}-${grpcCallRefIdCounter++}`;

    logger.debug({
      message: 'Master remote function call to worker',
      fnName,
      args,
      grpcRefId,
    });

    grpcCall[grpcRefId] = { fnName, callback, additionalCallbackArgs, worker };

    worker.jobCount++;

    logger.debug({
      message: 'Remote calling function on worker',
      grpcRefId,
      workerId: worker.workerId,
      // workerJobCount: worker.jobCount,
    });

    worker.connection.write({
      fnName,
      grpcRefId,
      args: argsProtobuf,
    });
  });
}

export function shutdown() {
  // Send signal to all connected workers
  workerList.forEach((worker) => {
    worker.connection.write({
      eventName: 'master_shuting_down',
    });
  });
  server.tryShutdown(() => {
    logger.info({ message: 'Job master gRPC server shutdown' });
  });
  workerList.forEach(({ connection }) => {
    connection.end();
  });
}
