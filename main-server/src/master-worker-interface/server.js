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

let exportElement = {};

let requestIdQueue = [];

let requestIdToGRPCRef = {};
let gRPCRefToRequestId = {};

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

let workerList = [];
let counter = 0;
let accessor_sign_url = '';
let dpki_url = {};

export const eventEmitter = new EventEmitter();
export const internalEventEmitter = new EventEmitter();

internalEventEmitter.on('accessor_sign_changed', (newUrl) => {
  logger.debug({
    message: 'Master change accessor url',
    newUrl,
  });
  accessor_sign_url = newUrl;
  workerList.forEach((connection) => {
    connection.write({
      type: 'accessor_sign_changed',
      args: newUrl,
    });
  });
});

internalEventEmitter.on('dpki_callback_url_changed', (newUrlObject) => {
  logger.debug({
    message: 'Master change dpki url',
    newUrlObject,
  });
  dpki_url = newUrlObject;
  workerList.forEach((connection) => {
    connection.write({
      type: 'dpki_callback_url_changed',
      args: JSON.stringify(newUrlObject),
    });
  });
});

internalEventEmitter.on('reInitKey', () => {
  logger.debug({
    message: 'Master re-init key',
  });
  workerList.forEach((connection) => {
    connection.write({
      type: 'reInitKey',
    });
  });
});

internalEventEmitter.on('invalidateDataSchemaCache', ({ serviceId }) => {
  logger.debug({
    message: 'Invalidate data schema cache',
    serviceId,
  });
  workerList.forEach((connection) => {
    connection.write({
      type: 'invalidateDataSchemaCache',
      args: serviceId
    });
  }); 
});

internalEventEmitter.on('invalidateNodesBehindProxyWithKeyOnProxyCache', () => {
  logger.debug({
    message: 'Invalidate node on proxy',
  });
  workerList.forEach((connection) => {
    connection.write({
      type: 'invalidateNodesBehindProxyWithKeyOnProxyCache',
    });
  }); 
});

export function initialize() {
  const server = new grpc.Server();
  const MASTER_SERVER_ADDRESS = `0.0.0.0:${config.masterServerPort}`;

  server.addService(proto.MasterWorker.service, {
    subscribe,
    tendermintCall,
    callbackCall,
    returnResultCall,
    messageQueueCall,
  });

  server.bind(MASTER_SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());
  server.start();

  logger.info({
    message: 'Master gRPC server initialzed'
  });
}

function messageQueueCall(call, done) {
  const { args } = call.request;
  let argArray = JSON.parse(args);
  eventEmitter.emit('mqCallByWorker', {
    argArray
  });
  done();
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
  let requestId = gRPCRefToRequestId[gRPCRef];
  if(requestId) {
    delete gRPCRefToRequestId[gRPCRef];
    delete requestIdToGRPCRef[requestId];
    resumeQueue(requestId);
  }
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

function subscribe(call) {
  workerList.push(call);
  call.write({
    type: 'accessor_sign_changed',
    args: accessor_sign_url,
  });
  call.write({
    type: 'dpki_callback_url_changed',
    args: JSON.stringify(dpki_url),
  });
}

function tendermintCall(call, done) {
  const {
    fnName, args, gRPCRef
  } = call.request;
  let argArray = JSON.parse(args);
  eventEmitter.emit('tendermintCallByWorker', {
    fnName, argArray, gRPCRef
  });
  done();
}

function callbackCall(call, done) {
  const { args } = call.request;
  let argArray = JSON.parse(args);
  eventEmitter.emit('callbackToClientByWorker', {
    argArray
  });
  done();
}

function addToQueue({ delegateData, workerIndex, requestId }) {
  logger.debug({
    message: 'Add to request queue',
    delegateData, workerIndex, requestId
  });
  if(!requestIdQueue[requestId]) {
    requestIdQueue[requestId] = [];
  }
  requestIdQueue[requestId].push({
    delegateData, workerIndex
  });
}

function resumeQueue(requestId) {
  logger.debug({
    message: 'Resume request queue',
    requestId,
    queue: requestIdQueue[requestId],
  });
  if(requestIdQueue[requestId] && requestIdQueue[requestId].length > 0) {
    let { delegateData, workerIndex } = requestIdQueue[requestId].splice(0,1)[0];
    delegateToWorker(delegateData, workerIndex);
  } else {
    delete requestIdQueue[requestId];
  }
}

function getRequestIdFromDelegateData(args) {
  for(let key in args) {
    if(key === 'requestId' || key === 'request_id') return args[key];
    if(typeof args[key] === 'object') {
      let requestId = getRequestIdFromDelegateData(args[key]);
      if(requestId) return requestId;
    }
  }
  return false;
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

export async function delegateToWorker({
  type, namespace, fnName, args,
}, workerIndex) {
  let gRPCRef = randomBase64Bytes(16); //random

  logger.debug({
    message: 'Master delegate',
    namespace,
    fnName,
    args,
    workerIndex,
    gRPCRef,
  });
  //Check requestId and queue here
  let requestId = getRequestIdFromDelegateData(args); //something
  if(requestId && requestIdToGRPCRef[requestId]) {
    addToQueue({
      delegateData: {
        type, namespace, fnName, args,
      },
      workerIndex,
      requestId,
    });
    return;
  }
  let index;
  if(workerList.length === 0) {
    logger.info({
      message: 'No worker connected, waiting...'
    });
    await waitForWorker();
  }
  if(!workerIndex) {
    index = counter;
    counter = (counter + 1)%workerList.length;
  }
  else index = workerIndex;
  if(requestId) {
    requestIdToGRPCRef[requestId] = gRPCRef;
    gRPCRefToRequestId[gRPCRef] = requestId;
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
  workerList[index].write({
    type, namespace, fnName, gRPCRef,
    args: JSON.stringify(args)
  });
  return waitForResult(gRPCRef);
}

export function tendermintReturnResult({
  gRPCRef, result, error
}) {
  logger.debug({
    message: 'Master return tendermint result',
    gRPCRef,
    result,
    error
  });
  workerList.forEach((connection) => {
    connection.write({
      type: 'tendermintResult',
      gRPCRef, result, error,
    });
  });
}

const functionList = {
  as: [
    'registerOrUpdateASService',
    'getServiceDetail',
    'processDataForRP',
  ],
  rp: [
    'removeDataFromAS',
    'removeAllDataFromAS',
    'getRequestIdByReferenceId',
    'getDataFromAS',
  ],
  idp: [
    'requestChallengeAndCreateResponse'
  ],
  ndid: [
    'registerNode',
    'initNDID',
    'endInit',
    'updateNode',
    'enableNode',
    'disableNode',
    'setNodeToken',
    'addNodeToken',
    'reduceNodeToken',
    'addNamespace',
    'enableNamespace',
    'disableNamespace',
    'addService',
    'updateService',
    'enableService',
    'disableService',
    'setValidator',
    'setTimeoutBlockRegisterIdentity',
    'approveService',
    'enableServiceDestination',
    'disableServiceDestination',
    'addNodeToProxyNode',
    'updateNodeProxyNode',
    'removeNodeFromProxyNode',
    'setLastBlock',
  ],
  proxy: [
    //'handleMessageFromQueue',
    //'handleTendermintNewBlock',
  ],
  common: [
    'closeRequest',
    'createRequest',
    'getPrivateMessages',
    'removePrivateMessages',
  ],
  identity: [
    'createIdentity',
    'getCreateIdentityDataByReferenceId',
    'getRevokeAccessorDataByReferenceId',
    'getIdentityInfo',
    'updateIal',
    'addAccessorMethodForAssociatedIdp',
    'revokeAccessorMethodForAssociatedIdp',
    'calculateSecret',
  ],
};


for(let namespace in functionList) {
  exportElement[namespace] = {};
  for(let i = 0 ; i < functionList[namespace].length ; i++) {
    let fnName = functionList[namespace][i];
    exportElement[namespace][fnName] = function() {
      return delegateToWorker({
        type: 'functionCall',
        namespace,
        fnName,
        args: arguments,
      });
    };
  }
}

export default exportElement;