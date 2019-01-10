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
import { randomBase64Bytes } from '../utils';
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
}

function waitForTendermintResult(gRPCRef, resolve) {
  eventEmitter.once('tendermintResult:' + gRPCRef, ({ result, error }) => {
    logger.debug({
      message: 'worker received tendermint result',
      gRPCRef,
      result,
      error,
    });
    result = JSON.parse(result);
    error = JSON.parse(error);
    if(error && error.name === 'CustomError') {
      error = new CustomError(error);
    }
    resolve({ result, error });
  });
}

function tendermint({ fnName, args }) {
  logger.debug({
    message: 'Worker calling tendermint transact',
    fnName,
    args
  });
  return new Promise((resolve, reject) => {
    let gRPCRef = randomBase64Bytes(16);
    client.tendermintCall({ 
      fnName, 
      gRPCRef,
      args: JSON.stringify(parseArgsToArray(args)) 
    }, (error) => {
      if(error) reject(error);
      else waitForTendermintResult(gRPCRef, resolve);
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
    if(obj && obj.error && obj.error.name === 'CustomError') {
      argArray[i].error = new CustomError(obj.error);
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
    gRPCRef,
    result,
    error,
  } = data;
  let argsJson, argArray;
  switch(type) {

    case 'reInitKey':
    case 'invalidateNodesBehindProxyWithKeyOnProxyCache':
      logger.debug({
        message: 'worker received event that need no argument, type:' + type,
      }); 
      eventEmitter.emit(type);
      return;

    case 'dpki_callback_url_changed':
      logger.debug({
        message: 'worker received event to change dpki callback',
        args,
      });
      argsJson = JSON.parse(args);
      eventEmitter.emit(type, argsJson);
      return;

    case 'accessor_sign_changed':
      logger.debug({
        message: 'worker received event to change accessor sign url',
        args,
      });
      eventEmitter.emit(type, args);
      return;

    case 'invalidateDataSchemaCache':
      logger.debug({
        message: 'worker received event to invalidate data schema cache',
      }); 
      eventEmitter.emit(type, args);
      return;

    case 'tendermintResult':
      eventEmitter.emit('tendermintResult:' + gRPCRef, { result, error });
      return;

    case 'functionCall':
    case 'callbackAfterBlockchain':
      logger.debug({
        message: 'Worker received delegated work',
        type,
        namespace,
        fnName,
        argArray,
        gRPCRef
      });
      argArray = parseArgsToArray(args);
      eventEmitter.emit(type, {
        namespace, fnName, argArray, gRPCRef
      });
      return;

    default:
      logger.debug({
        message: 'Worker received unrecognized event from master',
        data,
      });
      break;
  }
}

export default function() {
  return client;
}