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

const workerList = [];
const workerIdToJobRefMapping = {};
const jobRefToWorkerIdMapping = {};

const tendermintRefToWorkerId = {};

const workerTimeoutId = {};
const delegatedData = {};

let counter = 0;
let idp_callback_urls = {};
let as_callback_urls = {};
let as_service_callback_urls = {};
let dpki_urls = {};

export const eventEmitter = new EventEmitter();
export const internalEventEmitter = new EventEmitter();

internalEventEmitter.on('idp_callback_url_changed', (newUrlObject) => {
  logger.debug({
    message: 'Master change idp callback url',
    newUrlObject,
  });
  for(let key in newUrlObject) {
    if(newUrlObject[key]) idp_callback_urls[key] = newUrlObject[key];
  }
  workerList.forEach(({ connection }) => {
    connection.write({
      type: 'idp_callback_url_changed',
      args: JSON.stringify(newUrlObject),
    });
  });
});

internalEventEmitter.on('as_callback_url_changed', (newUrlObject) => {
  logger.debug({
    message: 'Master change as callback url',
    newUrlObject,
  });
  for(let key in newUrlObject) {
    if(newUrlObject[key]) as_callback_urls[key] = newUrlObject[key];
  }
  workerList.forEach(({ connection }) => {
    connection.write({
      type: 'as_callback_url_changed',
      args: JSON.stringify(newUrlObject),
    });
  });
});

internalEventEmitter.on('service_callback_url_changed', (newUrlObject) => {
  logger.debug({
    message: 'Master change as service callback url',
    newUrlObject,
  });
  const { nodeId, serviceId, url } = newUrlObject;
  as_service_callback_urls[`${nodeId}:${serviceId}`] = url;
  workerList.forEach(({ connection }) => {
    connection.write({
      type: 'service_callback_url_changed',
      args: JSON.stringify(newUrlObject),
    });
  });
});

internalEventEmitter.on('dpki_callback_url_changed', (newUrlObject) => {
  logger.debug({
    message: 'Master change dpki url',
    newUrlObject,
  });
  for(let key in newUrlObject) {
    if(newUrlObject[key]) dpki_urls[key] = newUrlObject[key];
  }
  workerList.forEach(({ connection }) => {
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
  workerList.forEach(({ connection }) => {
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
  workerList.forEach(({ connection }) => {
    connection.write({
      type: 'invalidateDataSchemaCache',
      args: serviceId
    });
  }); 
});

internalEventEmitter.on('changeChainId', (newChainId) => {
  logger.debug({
    message: 'Master change chainId',
    newChainId,
  });
  workerList.forEach(({ connection }) => {
    connection.write({
      type: 'changeChainId',
      args: newChainId
    });
  }); 
});

internalEventEmitter.on('changeLatestBlockHeight', (newBlockHeight) => {
  logger.debug({
    message: 'Master change latest block height',
    newBlockHeight,
  });
  workerList.forEach(({ connection }) => {
    connection.write({
      type: 'changeLatestBlockHeight',
      args: newBlockHeight
    });
  }); 
});

internalEventEmitter.on('invalidateNodesBehindProxyWithKeyOnProxyCache', () => {
  logger.debug({
    message: 'Invalidate node on proxy',
  });
  workerList.forEach(({ connection }) => {
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

  const workerId = jobRefToWorkerIdMapping[gRPCRef];
  delete jobRefToWorkerIdMapping[gRPCRef];
  for(let i = 0 ; i < workerIdToJobRefMapping[workerId].length ; i++) {
    if(workerIdToJobRefMapping[workerId][i] === gRPCRef) {
      workerIdToJobRefMapping[workerId].splice(i,1);
    }
  }
  delete delegatedData[gRPCRef];

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
  const { workerId } = call.request;
  workerList.push({
    connection: call,
    workerId,
  });

  if(!workerIdToJobRefMapping[workerId]) {
    workerIdToJobRefMapping[workerId] = [];
  }
  if(workerTimeoutId[workerId]) {
    clearTimeout(workerTimeoutId[workerId]);
    delete workerTimeoutId[workerId];
  }

  call.on('cancelled', () => {
    for(let i = 0 ; i < workerList.length ; i++) {
      if(workerList[i].workerId === workerId) workerList.splice(i,1);
    }
    //wait for some time to clear job mapping and re-delegate?
    workerTimeoutId[workerId] = setTimeout(() => {
      delete workerTimeoutId[workerId];
      workerIdToJobRefMapping[workerId].forEach((gRPCRef) => {
        let { data, specificWorkerId } = delegatedData[gRPCRef];
        delegateToWorker(data, specificWorkerId);
        delete jobRefToWorkerIdMapping[gRPCRef];
        delete delegatedData[gRPCRef];
      });
      delete workerIdToJobRefMapping[workerId];
    }, config.workerDisconnectedTimeout);
  });

  call.write({
    type: 'idp_callback_url_changed',
    args: JSON.stringify(idp_callback_urls),
  });
  call.write({
    type: 'as_callback_url_changed',
    args: JSON.stringify(as_callback_urls),
  });
  call.write({
    type: 'dpki_callback_url_changed',
    args: JSON.stringify(dpki_urls),
  });
  call.write({
    type: 'service_callback_url_changed',
    args: JSON.stringify(as_service_callback_urls),
  });
}

function tendermintCall(call, done) {
  const {
    fnName, args, gRPCRef, workerId
  } = call.request;
  let argArray = JSON.parse(args);
  tendermintRefToWorkerId[gRPCRef] = workerId;
  eventEmitter.emit('tendermintCallByWorker', {
    fnName, argArray, gRPCRef, workerId
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

function addToQueue({ delegateData, specificWorkerId, requestId, gRPCRef }) {
  logger.debug({
    message: 'Add to request queue',
    delegateData, specificWorkerId, requestId, gRPCRef
  });
  if(!requestIdQueue[requestId]) {
    requestIdQueue[requestId] = [];
  }
  requestIdQueue[requestId].push({
    delegateData, specificWorkerId, gRPCRef
  });
}

function resumeQueue(requestId) {
  logger.debug({
    message: 'Resume request queue',
    requestId,
    queue: requestIdQueue[requestId],
  });
  if(requestIdQueue[requestId] && requestIdQueue[requestId].length > 0) {
    let { delegateData, specificWorkerId, gRPCRef } = requestIdQueue[requestId].splice(0,1)[0];
    delegateToWorker(delegateData, specificWorkerId, gRPCRef, true);
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
}, specificWorkerId, gRPCRef = false, resume = false) {
  if(!gRPCRef) {
    gRPCRef = randomBase64Bytes(16); //random
  }

  logger.debug({
    message: 'Master delegate',
    namespace,
    fnName,
    args,
    specificWorkerId,
    gRPCRef,
  });
  //Check requestId and queue here
  let requestId = getRequestIdFromDelegateData(args); //something
  if(requestId && requestIdToGRPCRef[requestId] && type === 'functionCall') {
    addToQueue({
      delegateData: {
        type, namespace, fnName, args,
      },
      specificWorkerId,
      requestId,
      gRPCRef,
    });
    return waitForResult(gRPCRef);
  }
  
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
  if(requestId && type === 'functionCall') {
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
  let { connection, workerId } = workerList[index];
  connection.write({
    type, namespace, fnName, gRPCRef,
    args: JSON.stringify(args)
  });
  workerIdToJobRefMapping[workerId].push(gRPCRef);
  jobRefToWorkerIdMapping[gRPCRef] = workerId;
  delegatedData[gRPCRef] = [{
    type, namespace, fnName, args,
  }, specificWorkerId];
  if(!resume) return waitForResult(gRPCRef);
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
  workerList.forEach(({ connection, workerId }) => {
    if(workerId === tendermintRefToWorkerId[gRPCRef]) {
      connection.write({
        type: 'tendermintResult',
        gRPCRef, result, error,
      });
      delete tendermintRefToWorkerId[gRPCRef];
    }
  });
}

const functionList = {
  as: [
    'registerOrUpdateASService',
    'getServiceDetail',
    'processDataForRP',
    'processRequest',
  ],
  rp: [
    'removeDataFromAS',
    'removeAllDataFromAS',
    'getRequestIdByReferenceId',
    'getDataFromAS',
    'sendRequestToAS',
    'processAsData',
  ],
  idp: [
    'requestChallengeAndCreateResponse',
    'processMessage',
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

export function getCoreFunction(namespace, fnName) {
  return exportElement[namespace][fnName];
}

export default exportElement;