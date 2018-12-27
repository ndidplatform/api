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

import grpc from 'grpc';
import path from 'path';
import * as protoLoader from '@grpc/proto-loader';

import * as core from '../core';
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
const MASTER_SERVER_ADDRESS = `${config.masterServerIp}:${config.masterServerPort}`;

const client = new proto.MasterWorker(
  MASTER_SERVER_ADDRESS,
  grpc.credentials.createInsecure()
);
let workerSubscribeChannel = client.subscribe(null);
workerSubscribeChannel.on('data', onRecvData);

function onRecvData(data) {
  const {
    type,
    namespace,
    fnName,
    args
  } = data;
  let argArray = JSON.parse(args);
  switch(type) {
    case 'callbackAfterBlockchain':
      core.common.getFunction(fnName)(...argArray);
      break;
    case 'functionCall':
      core[namespace][fnName](...argArray);
      break;
    default:
      throw 'Unrecognized type';
  }
}

export default client;