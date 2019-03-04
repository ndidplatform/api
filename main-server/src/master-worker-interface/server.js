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

import { randomBase64Bytes } from '../utils';
import CustomError from 'ndid-error/custom_error';
import logger from '../logger';

import * as config from '../config';

let server;
let stoppingWorkerCount = 0;

const workerList = [];
const workerLostHandling = {};

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
    // 'grpc.http2.min_ping_interval_without_data_ms':
    //   config.grpcExpectedClientPingInterval,
    'grpc.http2.min_ping_interval_without_data_ms': config.grpcPingInterval,
    'grpc.http2.min_time_between_pings_ms': config.grpcPingInterval,
    'grpc.max_receive_message_length': -1,
  });
  const MASTER_SERVER_ADDRESS = `0.0.0.0:${config.masterServerPort}`;

  server.addService(proto.MasterWorker.service, {
    subscribe,
    timerJobsCall,
    returnResultCall,
    workerStoppingCall,
  });

  server.bind(MASTER_SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());
  server.start();

  logger.info({
    message: 'Master gRPC server initialzed',
  });
}

function subscribe(call) {
  logger.info({
    message: 'New worker connected',
  });
  const { workerId } = call.request;

  if (workerLostHandling[workerId]) {
    //duplicate workerId
    call.end();
    return;
  }

  workerLostHandling[workerId] = {
    mq: {},
    callback: {},
    requestTimeout: {},
  };

  workerList.push({
    connection: call,
    workerId,
    jobCount: 0,
    stopping: false,
  });

  call.on('cancelled', () => {
    for (let i = 0; i < workerList.length; i++) {
      if (workerList[i].workerId === workerId) {
        if (workerList[i].stopping) stoppingWorkerCount--;
        workerList.splice(i, 1);
      }
    }
    handleWorkerLost(workerId);
  });

  eventEmitter.emit('worker_connected', workerId);
}

function handleRequestTimeoutWorkerLost(workerId) {
  for (let requestId in workerLostHandling[workerId].requestTimeout) {
    const { deadline } = workerLostHandling[workerId].requestTimeout[requestId];
    if (Date.now() < deadline) {
      delegateToWorker({
        fnName: 'common.setTimeoutScheduler',
        args: [config.nodeId, requestId, (deadline - Date.now()) / 1000],
      });
    }
  }
}

function handleCallbackRetryWorkerLost(workerId) {
  for (let cbId in workerLostHandling[workerId].callback) {
    const { deadline } = workerLostHandling[workerId].callback[cbId];
    if (Date.now() < deadline) {
      delegateToWorker({
        fnName: 'callback.handleCallbackWorkerLost',
        args: [cbId, deadline],
      });
    }
  }
}

function handleMqRetryWorkerLost(workerId) {
  for (let msgId in workerLostHandling[workerId].mq) {
    delegateToWorker({
      fnName: 'mq.handleMqWorkerLost',
      args: [msgId],
    });
  }
}

function handleWorkerLost(workerId) {
  handleRequestTimeoutWorkerLost(workerId);
  handleCallbackRetryWorkerLost(workerId);
  handleMqRetryWorkerLost(workerId);
  delete workerLostHandling[workerId];
}

function workerStoppingCall(call, done) {
  const { workerId } = call.request;
  workerList.forEach((worker) => {
    if (worker.workerId === workerId) {
      if (!worker.stopping) stoppingWorkerCount++;
      worker.stopping = true;
    }
  });
  done();
}

function timerJobsCall(call, done) {
  let { jobsDetail, workerId } = call.request;
  jobsDetail = JSON.parse(jobsDetail);
  jobsDetail.forEach(({ type, ...jobs }) => {
    for (let jobId in jobs) {
      if (workerLostHandling[workerId][type][jobId]) {
        throw 'Duplicate job';
      }
      workerLostHandling[workerId][type][jobId] = jobs[jobId];
    }
  });
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

export function shutdown() {
  server.tryShutdown(() => {
    logger.info({ message: 'Job master gRPC server shutdown' });
  });
  workerList.forEach(({ connection }) => {
    connection.end();
  });
}
