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

import { randomBase64Bytes } from '../utils';
import CustomError from 'ndid-error/custom_error';
import logger from '../logger';

import * as config from '../config';

let server;

// const jobTypeList = ['mq', 'callback'];
const workerList = [];
const workerLostHandling = {};
let counter = 0;

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
    'grpc.max_receive_message_length': -1,
  });
  const MASTER_SERVER_ADDRESS = `0.0.0.0:${config.masterServerPort}`;

  server.addService(proto.MasterWorker.service, {
    subscribe,
    jobRetryCall,
    returnResultCall,
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
  };

  workerList.push({
    connection: call,
    workerId,
    jobCount: 0,
  });

  call.on('cancelled', () => {
    for (let i = 0; i < workerList.length; i++) {
      if (workerList[i].workerId === workerId) workerList.splice(i, 1);
    }
    // TODO
    // handleWorkerLost(workerId);
  });

  eventEmitter.emit('worker_connected', workerId);
}

// function handleWorkerLost(workerId) {
//   jobTypeList.forEach((type) => {
//     let giveUpTimeObject = workerLostHandling[workerId][type];
//     for (let dataId in giveUpTimeObject) {
//       let giveUpTime = giveUpTimeObject[dataId];
//       if (Date.now() < giveUpTime) {
//         delegateToWorker({
//           type: 'handleRetry',
//           args: (function(type, dataId, giveUpTime) {
//             //cast to arguments object
//             return arguments;
//           })(),
//         });
//       }
//     }
//   });
//   delete workerLostHandling[workerId];
// }

function jobRetryCall(call, doneFn) {
  const { dataId, giveUpTime, done, workerId, type } = call.request;

  if (workerLostHandling[workerId][type][dataId]) {
    if (!done) throw 'Duplicate job';
    delete workerLostHandling[workerId][type][dataId];
    return;
  }
  workerLostHandling[workerId][type][dataId] = giveUpTime;
  doneFn();
}

function waitForWorker() {
  return new Promise((resolve) => {
    let id = setInterval(() => {
      if (workerList.length > 0) {
        clearInterval(id);
        resolve();
      }
    }, 2000);
  });
}

function returnResultCall(call, done) {
  const { grpcRefId, retValStr, error } = call.request;
  if (grpcCall[grpcRefId]) {
    const { callback, worker } = grpcCall[grpcRefId];
    if (error) {
      logger.error(error);
      return;
    }
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
      } else {
        retVal = [];
      }
      callback(...retVal);
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
  // if (workerList.length === 0) {
  //   logger.info({
  //     message: 'No worker connected, waiting...',
  //   });
  //   await waitForWorker();
  // }

  if (workerList.length === 0) {
    throw new Error('No worker available');
  }

  if (!specificWorkerId) {
    // Round-robin
    // counter = (counter + 1) % workerList.length;
    // const index = counter;

    // Least job count
    let min = workerList[0].jobCount;
    let index = 0;
    for (let i = 1; i < workerList.length; i++) {
      if (workerList[i].jobCount < min) {
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

export async function delegateToWorker({
  fnName,
  args,
  callback,
  metaData,
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

  grpcCall[grpcRefId] = { callback, worker };

  worker.jobCount++;

  logger.debug({
    message: 'Sending job to worker',
    grpcRefId,
    workerId: worker.workerId,
    workerJobCount: worker.jobCount,
  });

  worker.connection.write({
    fnName,
    grpcRefId,
    args: JSON.stringify(args),
    metaData: JSON.stringify(metaData),
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
