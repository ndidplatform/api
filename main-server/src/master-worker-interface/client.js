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
import CustomError from 'ndid-error/custom_error';
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
  client.returnResult = returnResult;
  client.messageQueue = messageQueue;
  //workerSubscribeChannel = client.subscribe(null);
  //workerSubscribeChannel.on('data', onRecvData);
}

function tendermint({ fnName, args }) {
  logger.debug({
    message: 'Worker calling tendermint transact',
    fnName,
    args
  });
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

function returnResult({ gRPCRef, result, error }) {
  logger.debug({
    message: 'Worker return result',
    gRPCRef,
    result,
    error,
  });
  return new Promise((resolve, reject) => {
    client.returnResultCall({ 
      gRPCRef,
      result,
      error, 
    }, (error) => {
      if(error) reject(error);
      else resolve();
    });
  });
}

function callback({ args }) {
  logger.debug({
    message: 'Worker calling callback',
    args
  });
  return new Promise((resolve, reject) => {
    client.callbackCall({ 
      args: JSON.stringify(parseArgsToArray(args)) 
    }, (error) => {
      if(error) reject(error);
      else resolve();
    });
  });
}

function messageQueue({ args }) {
  logger.debug({
    message: 'Worker calling mq',
    args
  });
  return new Promise((resolve, reject) => {
    client.messageQueueCall({ 
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
  for(let i = 0 ; argArray.length <= length ; i++) {
    argArray.push(argJson[i.toString()]);
  }
  //parse to custom error
  for(let i = 0 ; i < argArray.length ; i++) {
    let obj = argArray[i];
    if(obj && obj.error && obj.error.code) {
      argArray[i] = { 
        error: new CustomError(obj) 
      };
    }
  }
  return argArray;
}

async function onRecvData(data) {
  const {
    type,
    namespace,
    fnName,
    args,
    gRPCRef
  } = data;
  let argsJson;
  logger.debug({
    message: 'Worker received data',
    data,
    type,
    namespace,
    fnName,
    args,
    gRPCRef,
  });
  switch(type) {
    case 'accessor_sign_changed':
      logger.debug({
        message: 'worker change accessor sign url',
        args,
      });
      eventEmitter.emit('accessor_sign_changed', args);
      return;
    case 'dpki_callback_url_changed':
      logger.debug({
        message: 'worker change dpki callback',
        args,
      });
      argsJson = JSON.parse(args);
      eventEmitter.emit('dpki_callback_url_changed', argsJson);
      return;
    case 'reInitKey':
      logger.debug({
        message: 'worker re-init key',
      }); 
      eventEmitter.emit('reInitKey');
      return;
    case 'invalidateDataSchemaCache':
      logger.debug({
        message: 'worker invalidate data schema cache',
      }); 
      eventEmitter.emit('invalidateDataSchemaCache', args);
      return;
    default: break;
  }
  let argArray = parseArgsToArray(args);
  eventEmitter.emit(type, {
    namespace, fnName, argArray, gRPCRef
  });
}

export default function() {
  return client;
}