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

//gRPC server
import path from 'path';
import grpc from 'grpc';
import * as protoLoader from '@grpc/proto-loader';

import * as config from '../config';
import { EventEmitter } from 'events';
import logger from '../logger';
import { randomBase64Bytes } from '../utils';
import CustomError from 'ndid-error/custom_error';

export const eventEmitter = new EventEmitter();

const jobTypeList = ['mq','callback'];
const workerList = [];
const workerLostHandling = {};
let counter = 0;

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

export function initialize() {
  const server = new grpc.Server();
  const MASTER_SERVER_ADDRESS = `0.0.0.0:${config.masterServerPort}`;

  server.addService(proto.MasterWorker.service, {
    subscribe,
    jobRetryCall,
    returnResultCall,
  });

  server.bind(MASTER_SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());
  server.start();

  logger.info({
    message: 'Master gRPC server initialzed'
  });
}

function subscribe(call) {
  const { workerId } = call.request;

  if(workerLostHandling[workerId]) {
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
  });

  call.on('cancelled', () => {
    for(let i = 0 ; i < workerList.length ; i++) {
      if(workerList[i].workerId === workerId) workerList.splice(i,1);
    }
    handleWorkerLost(workerId);
  });
}

function handleWorkerLost(workerId) {
  jobTypeList.forEach((type) => {
    let giveUpTimeObject = workerLostHandling[workerId][type];
    for(let dataId in giveUpTimeObject) {
      let giveUpTime = giveUpTimeObject[dataId];
      if(Date.now() < giveUpTime) {
        delegateToWorker({
          type: 'handleRetry',
          args: function(type, dataId, giveUpTime) {
            //cast to arguments object
            return arguments;
          }()
        });
      }
    }
  });
  delete workerLostHandling[workerId];
}

function jobRetryCall(call, doneFn) {
  const {
    dataId, giveUpTime, done, workerId, type
  } = call.request;

  if(workerLostHandling[workerId][type][dataId]) {
    if(!done) throw 'Duplicate job';
    delete workerLostHandling[workerId][type][dataId];
    return;
  }
  workerLostHandling[workerId][type][dataId] = giveUpTime;
  doneFn();
}

function waitForWorker() {
  return new Promise((resolve) => {
    let id = setInterval(() => {
      if(workerList.length > 0) {
        clearInterval(id);
        resolve();
      }
    },2000);
  });
}

function returnResultCall(call, done) {
  const {
    gRPCRef,
    result,
    error,
  } = call.request;
  eventEmitter.emit('result:' + gRPCRef, {
    result: JSON.parse(result),
    error: JSON.parse(error),
  });
  done();
}

async function waitForResult(waitForRef) {
  return new Promise((resolve, reject) => {
    eventEmitter.once('result:' + waitForRef, ({ result, error }) => {
      logger.debug({
        message: 'Master received result',
        waitForRef,
        result,
        error,
      });
      if(error == null) resolve(result);
      else {
        if(error.name === 'CustomError') {
          error = new CustomError(error);
        }
        reject(error);
      }
    });
  });
}

export async function delegateToWorker({
  type, 
  args,
}, specificWorkerId, gRPCRef = false) {
  if(!gRPCRef) {
    gRPCRef = randomBase64Bytes(16); //random
  }

  logger.debug({
    message: 'Master delegate',
    args,
    specificWorkerId,
    gRPCRef,
  });
  
  let index;
  if(workerList.length === 0) {
    logger.info({
      message: 'No worker connected, waiting...'
    });
    await waitForWorker();
  }

  if(!specificWorkerId) {
    counter = (counter + 1)%workerList.length;
    index = counter;
  }
  else {
    for(let i = 0 ; i < workerList.length ; i++) {
      if(workerList[i].workerId === specificWorkerId) {
        index = i;
        break;
      }
    }
    if(!index) throw 'Worker not found';
  }

  for(let key in args) {
    if(
      args[key] && 
      args[key].error && 
      args[key].error.name === 'CustomError'
    ) {
      let obj = args[key];
      args[key].error = {
        message: obj.error.getMessageWithCode(), 
        code: obj.error.getCode(), 
        clientError: obj.error.isRootCauseClientError(),
        //errorType: error.errorType,
        details: obj.error.getDetailsOfErrorWithCode(),
        cause: obj.error.cause,
        name: 'CustomError',
      };
    }
  }
  let { connection } = workerList[index];
  connection.write({
    type, 
    gRPCRef,
    args: JSON.stringify(args)
  });
  return waitForResult(gRPCRef);
}

export function shutdown() {
  workerList.forEach(({ connection }) => {
    connection.end();
  });
}