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

export function initialize() {
  const server = new grpc.Server();
  const MASTER_SERVER_ADDRESS = `0.0.0.0:${config.masterServerPort}`;

  server.addService(proto.MasterWorker.service, {
    subscribe,
    tendermint,
    callback
  });

  server.bind(MASTER_SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());
  server.start();
  logger.info({
    message: 'Master gRPC server initialzed'
  });
}

export const eventEmitter = new EventEmitter();

function subscribe(call) {
  workerList.push(call);
}

function tendermint(call) {
  const {
    fnName, args
  } = call.request;
  let argArray = JSON.parse(args);
  eventEmitter.emit('tendermintCallByWorker', {
    fnName, argArray
  });
}

function callback(call) {
  const { args } = call.request;
  let argArray = JSON.parse(args);
  eventEmitter.emit('callbackToClientByWorker', {
    argArray
  });
}

export function delegateToWorker(args, workerIndex) {
  let index;
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
  else workerList[index].write(args);
}

const exportElement = {
  as: {
    registerOrUpdateASService: false,
    getServiceDetail: false,
    processDataForRP: false,
  },
  rp: {
    removeDataFromAS: false,
    removeAllDataFromAS: false,
    getRequestIdByReferenceId: false,
    getDataFromAS: false,
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
    closeRequest: false,
    createRequest: false,
  },
  identity: {
    createIdentity: false,
    getCreateIdentityDataByReferenceId: false,
    getRevokeAccessorDataByReferenceId: false,
    getIdentityInfo: false,
    updateIal: false,
    addAccessorMethodForAssociatedIdp: false,
    revokeAccessorMethodForAssociatedIdp: false,
    calculateSecret: false,
  },
};

for(let namespace in exportElement) {
  for(let fnName in exportElement[namespace]) {
    exportElement[namespace][fnName] = function() {
      delegateToWorker({
        type: 'functionCall',
        namespace,
        fnName,
        args: JSON.stringify(arguments)
      });
    };
  }
}

export default exportElement;