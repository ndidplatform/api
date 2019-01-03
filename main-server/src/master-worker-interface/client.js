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

import * as config from '../config';
import logger from '../logger';
import { EventEmitter } from 'events';

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
let client = null;
let connectivityState = null;
let workerSubscribeChannel = null;

export const eventEmitter = new EventEmitter();

function watchForNextConnectivityStateChange() {
  if (client == null) {
    throw new Error('client is not initialized');
  }
  client
    .getChannel()
    .watchConnectivityState(
      client.getChannel().getConnectivityState(true),
      Infinity,
      async (error) => {
        if (error) {
          logger.error({
            message: 'Worker service gRPC connectivity state watch error',
            error,
          });
        } else {
          const newConnectivityState = client
            .getChannel()
            .getConnectivityState();
          logger.debug({
            message: 'Worker service gRPC connectivity state changed',
            connectivityState,
            newConnectivityState,
          });

          // on reconnect (IF watchForNextConnectivityStateChange() this called after first waitForReady)
          if (connectivityState === 1 && newConnectivityState === 2) {
            logger.info({
              message: 'Worker service gRPC reconnect',
            });
            workerSubscribeChannel = client.subscribe(null);
            workerSubscribeChannel.on('data', onRecvData); 
          }
          connectivityState = newConnectivityState;
        }
        watchForNextConnectivityStateChange();
      }
    );
}

async function waitForReady(client) {
  await new Promise((resolve, reject) => {
    client.waitForReady(Infinity, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function initialize() {
  client = new proto.MasterWorker(
    MASTER_SERVER_ADDRESS,
    grpc.credentials.createInsecure()
  );
  watchForNextConnectivityStateChange();
  await waitForReady(client);
  client.tendermint = tendermint;
  client.callback = callback;
  //workerSubscribeChannel = client.subscribe(null);
  //workerSubscribeChannel.on('data', onRecvData);
}

function tendermint({ fnName, args }) {
  return new Promise((resolve, reject) => {
    client.tendermintCall({ 
      fnName, 
      args: JSON.stringify(parseArgsToArray(args)) 
    }, (error) => {
      if(error) reject(error);
      else resolve();
    });
  });
}

function callback({ args }) {
  return new Promise((resolve, reject) => {
    client.callbackCall({ 
      args: JSON.stringify(parseArgsToArray(args)) 
    }, (error) => {
      if(error) reject(error);
      else resolve();
    });
  });
}

function parseArgsToArray(args) {
  let argJson = JSON.parse(args);
  let length = Object.keys(argJson).reduce((accum, current) => 
    Math.max(parseInt(current),accum)
  );
  let argArray = [];
  //convert to array (some arg is missing key zero)
  for(let i = 0 ; argArray.length < length ; i++) {
    argArray.push(argJson[i.toString()]);
  }
  return argArray;
}

function onRecvData(data) {
  const {
    type,
    namespace,
    fnName,
    args
  } = data;
  let argArray = parseArgsToArray(args);
  eventEmitter.emit(type, {
    namespace, fnName, argArray
  });
}

export default function() {
  return client;
}