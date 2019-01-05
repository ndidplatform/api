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
export const internalEmitter = new EventEmitter();

internalEmitter.on('accessor_sign_changed', (newUrl) => {
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

internalEmitter.on('dpki_callback_url_changed', (newUrlObject) => {
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

internalEmitter.on('reInitKey', () => {
  logger.debug({
    message: 'Master re-init key',
  });
  workerList.forEach((connection) => {
    connection.write({
      type: 'reInitKey',
    });
  });
});

internalEmitter.on('invalidateDataSchemaCache', ({ serviceId }) => {
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
  internalEmitter.emit('result', {
    gRPCRef, 
    result: JSON.parse(result),
    error: JSON.parse(error),
  });
  done();
}

async function waitForResult(waitForRef) {
  return new Promise((resolve, reject) => {
    internalEmitter.once('result', ({ gRPCRef, result, error }) => {
      if(gRPCRef === waitForRef) {
        logger.debug({
          message: 'Master received result',
          gRPCRef,
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
    fnName, args
  } = call.request;
  let argArray = JSON.parse(args);
  eventEmitter.emit('tendermintCallByWorker', {
    fnName, argArray
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

export function delegateToWorker({
  type, namespace, fnName, args, needResult,
}, workerIndex) {
  logger.debug({
    message: 'Master delegate',
    namespace,
    fnName,
    args,
    workerIndex,
  });
  let index, gRPCRef = '';
  if(!workerIndex) {
    index = counter;
    counter = (counter + 1)%workerList.length;
  }
  else index = workerIndex;
  if(workerList.length === 0) {
    logger.info({
      message: 'No worker connected, waiting...'
    });
    setTimeout(() => {
      delegateToWorker(args, workerIndex);
    }, 2000);
  }
  else {
    if(needResult) {
      gRPCRef = randomBase64Bytes(16); //random
    }
    workerList[index].write({
      type, namespace, fnName, gRPCRef,
      args: JSON.stringify(args)
    });
    if(needResult) {
      return waitForResult(gRPCRef);
    }
  }
}

const exportElement = {
  as: {
    registerOrUpdateASService: true,
    getServiceDetail: true,
    processDataForRP: true,
  },
  rp: {
    removeDataFromAS: false,
    removeAllDataFromAS: false,
    getRequestIdByReferenceId: true,
    getDataFromAS: true,
  },
  idp: {
    requestChallengeAndCreateResponse: false,
  },
  ndid: {
    registerNode: false,
    initNDID: false,
    endInit: false,
    updateNode: false,
    enableNode: false,
    disableNode: false,
    setNodeToken: false,
    addNodeToken: false,
    reduceNodeToken: false,
    addNamespace: false,
    enableNamespace: false,
    disableNamespace: false,
    addService: false,
    updateService: false,
    enableService: false,
    setValidator: false,
    setTimeoutBlockRegisterIdentity: false,
    approveService: false,
    enableServiceDestination: false,
    disableServiceDestination: false,
    addNodeToProxyNode: false,
    updateNodeProxyNode: false,
    removeNodeFromProxyNode: false,
    setLastBlock: false,
  },
  proxy: {
    handleMessageFromQueue: false,
    handleTendermintNewBlock: false,
  },
  common: {
    closeRequest: true,
    createRequest: true,
  },
  identity: {
    createIdentity: true,
    getCreateIdentityDataByReferenceId: true,
    getRevokeAccessorDataByReferenceId: true,
    getIdentityInfo: true,
    updateIal: true,
    addAccessorMethodForAssociatedIdp: true,
    revokeAccessorMethodForAssociatedIdp: true,
    calculateSecret: true,
  },
};

for(let namespace in exportElement) {
  for(let fnName in exportElement[namespace]) {
    let needResult = exportElement[namespace][fnName]; 
    exportElement[namespace][fnName] = function() {
      return delegateToWorker({
        type: 'functionCall',
        namespace,
        fnName,
        args: arguments,
        needResult,
      });
    };
  }
}

export default exportElement;