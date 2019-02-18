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
import { ExponentialBackoff } from 'simple-backoff';
import { wait } from '../utils';
import { processMessage as rpProcessMessage } from '../core/rp';
import { processMessage as idpProcessMessage } from '../core/idp';
import { processMessage as asProcessMessage } from '../core/as';
import { getMessageFromProtobufMessage } from '../mq';

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
const workerId = randomBase64Bytes(8);

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
              workerId,
            });
            workerSubscribeChannel = client.subscribe({ workerId });
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

function gRPCRetry(fn) {
  const backoff = new ExponentialBackoff({
    min: 2000,
    max: 10000,
    factor: 2,
    jitter: 0.2,
  });
  let startTime = Date.now();
  let retry = async function () {
    if(Date.now() - startTime < config.workerCallTimeout) {
      try {
        await fn(...arguments);
      }
      catch(error) {
        await wait(backoff.next());
        await retry(...arguments);
      }
    }
    else return fn(...arguments); //retry for the last time
  };
  return retry;
}

export async function initialize() {
  client = new proto.MasterWorker(
    MASTER_SERVER_ADDRESS,
    grpc.credentials.createInsecure()
  );
  watchForNextConnectivityStateChange();
  await waitForReady(client);
  client.jobRetry = gRPCRetry(jobRetry);
}

/*  
  Tell master that we are retrying something.
  If we are lost, master will tell another worker to retry it for us.
  type: timeoutRequest, dataId = requestId
  type: mqSend, dataId = messageId,
  type: callback, dataId = cbId,
*/
function jobRetry({
  dataId, giveUpTime, done = false, type
}) {
  return new Promise((resolve, reject) => {
    client.jobRetryCall({
      dataId, giveUpTime, done, type
    }, (error) => {
      if(error) reject(error);
      else resolve();
    });
  });
}

/*function tendermint({ args }) {
  let gRPCRef = randomBase64Bytes(16);
  logger.debug({
    message: 'Worker calling tendermint transact',
    args,
    gRPCRef,
  });
  return new Promise((resolve, reject) => {
    client.tendermintCall({ 
      gRPCRef,
      workerId,
      args: JSON.stringify(parseArgsToArray(args)) 
    }, (error) => {
      if(error) reject(error);
      else waitForTendermintResult(gRPCRef, resolve);
    });
  });
}*/

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

/*function callback({ args }) {
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
}*/

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
    args,
    gRPCRef,
    metaData,
  } = data;

  let argArray = parseArgsToArray(args), result, processFunction;
  logger.debug({
    message: 'Worker received delegated work',
    type,
    argArray,
    gRPCRef
  });
  let metaDataObj = JSON.parse(metaData);
  let effectiveRole = (config.role === 'proxy') ? metaDataObj.role : config.role;
  let retryType = metaDataObj.retryType;
    
  switch(type) {
    case 'handleRetry':
      switch(retryType) {
        case 'timeoutRequest':
          break;
        case 'mqSend':
          break;
        case 'callback':
          break;
        default:
          throw '';
      }
      return;
    
    case 'decrypt':
      try {
        result = await getMessageFromProtobufMessage(...argArray);
        await gRPCRetry(returnResult)({ gRPCRef, result });
      }
      catch(error) {
        await gRPCRetry(returnResult)({ gRPCRef, error }); 
      }
      return;

    case 'processMessage':
      switch(effectiveRole) {
        case 'rp': 
          processFunction = rpProcessMessage;
          break;
        case 'idp': 
          processFunction = idpProcessMessage;
          break;
        case 'as': 
          processFunction = asProcessMessage;
          break;
        default:
          throw '';
      }
      try {
        result = await processFunction(...argArray);
        await gRPCRetry(returnResult)({ gRPCRef, result });
      }
      catch(error) {
        await gRPCRetry(returnResult)({ gRPCRef, error }); 
      }
      return;

    case 'processBlockTask':
      return;

    default:
      logger.debug({
        message: 'Worker received unrecognized event from master',
        data,
      });
      return;
  }
}

export function shutdown() {
  workerSubscribeChannel.cancel();
  client.cancel();
}

export default function() {
  return client;
}