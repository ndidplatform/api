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

import * as tendermintNdid from '../tendermint/ndid';
import * as config from '../config';
import { callbackToClient } from '../utils/callback';

// Load protobuf
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'master_worker.proto'),
  {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);
const proto = grpc.loadPackageDefinition(packageDefinition);

const server = new grpc.Server();
const MASTER_SERVER_ADDRESS = `0.0.0.0:${config.masterServerPort}`;

let workerList = [];
let counter = 0;

server.addService(proto.MasterWorker.service, {
  subscribe,
  tendermint,
  callback
});

server.bind(MASTER_SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());
server.start();

function subscribe(call) {
  workerList.push(call);
}

function tendermint(call) {
  const {
    fnName, args
  } = call.request;
  let argArray = JSON.parse(args);
  tendermintNdid[fnName](...argArray);
}

function callback(call) {
  const { args } = call.request;
  let argArray = JSON.parse(args);
  callbackToClient(...argArray);
}

function delegateToWorker(args, workerIndex) {
  let index;
  if(!workerIndex) {
    index = counter;
    counter = (counter + 1)%workerList.length;
  }
  else index = workerIndex;
  workerList[index].write(args);
}

export default {
  as: {
    registerOrUpdateASService: function() {
      delegateToWorker({
        type: 'functionCall',
        namespace: 'as',
        fnName: 'registerOrUpdateASService',
        args: arguments
      });
    },
    getServiceDetail: function() {
      delegateToWorker({
        type: 'functionCall',
        namespace: 'as',
        fnName: 'getServiceDetail',
        args: arguments
      });
    },
    processDataForRP: function() {
      delegateToWorker({
        type: 'functionCall',
        namespace: 'as',
        fnName: 'processDataForRP',
        args: arguments
      });
    },
  },
  rp: {},
  idp: {},
  ndid: {},
  proxy: {},
  common: {},
  identity: {},
};