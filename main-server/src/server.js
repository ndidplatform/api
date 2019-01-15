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

import 'source-map-support/register';

import 'dotenv/config';
import mkdirp from 'mkdirp';

import './env_var_validate';

import * as httpServer from './http_server';
import * as node from './node';
import * as core from './core';
import * as nodeKey from './utils/node_key';

import * as cacheDb from './db/cache';
import * as longTermDb from './db/long_term';
import * as tendermint from './tendermint';
import * as tendermintNdid from './tendermint/ndid';
import * as tendermintWsPool from './tendermint/ws_pool';
import * as mq from './mq';
import { stopAllCallbackRetries, callbackToClient } from './utils/callback';
import * as externalCryptoService from './utils/external_crypto_service';

import { changeCallbackUrlForWorker as changeIdpCallbackUrlForWorker } from './core/idp/index';
import { changeCallbackUrlForWorker as changeAsCallbackUrlForWorker, 
  changeServiceCallbackUrlForWorker 
} from './core/as/index';
import { invalidateDataSchemaCache } from './core/as/data_validator';
import { invalidateNodesBehindProxyWithKeyOnProxyCache } from './node';

import logger from './logger';

import * as config from './config';
import { 
  eventEmitter as masterEventEmitter, 
  initialize as masterInitialize,
  tendermintReturnResult,
  shutdown as masterShutdown,
} from './master-worker-interface/server';
import { 
  eventEmitter as workerEventEmitter,
  initialize as workerInitialize,
  shutdown as workerShutdown,
} from './master-worker-interface/client';

import getClient from './master-worker-interface/client';

const common = core.common;

process.on('unhandledRejection', function(reason, p) {
  if (reason && reason.name === 'CustomError') {
    logger.error({
      message: 'Unhandled Rejection',
      p,
    });
    logger.error(reason.getInfoForLog());
  } else {
    logger.error({
      message: 'Unhandled Rejection',
      p,
      reason: reason.stack || reason,
    });
  }
});

async function processCallAndReturn({
  type, namespace, fnName, argArray, gRPCRef,
  processFunction, returnResultFunction,
}) {
  logger.debug({
    message: type,
    namespace,
    fnName,
    argArray,
    gRPCRef,
  });
  try {
    let result = await processFunction.apply(null, argArray);
    await returnResultFunction({
      gRPCRef,
      result: JSON.stringify(result || null), //if undefined, convert to null
      error: JSON.stringify(null),
    });
  } 
  catch(error) {
    logger.error({
      message: type + ' error',
      namespace,
      fnName,
      error,
      gRPCRef,
    });
    let errorSend = false;
    if(error.name === 'CustomError') {
      errorSend = {
        message: error.getMessageWithCode(), 
        code: error.getCode(), 
        clientError: error.isRootCauseClientError(),
        //errorType: error.errorType,
        details: error.getDetailsOfErrorWithCode(),
        cause: error.cause,
        name: 'CustomError',
      };
    }
    await returnResultFunction({
      gRPCRef,
      result: JSON.stringify(null),
      error: JSON.stringify(errorSend || error),
    });
  }
}

async function initialize() {
  if(config.isStandAlone) initializeMaster(true);
  else if(config.isMaster) initializeMaster(false);
  else initializeWorker();
}

async function initializeWorker() {
  logger.info({ message: 'Initializing worker' });
  try {
    tendermint.loadSavedData();
    //connect to tendermint for query only
    if (config.ndidNode) {
      tendermint.setWaitForInitEndedBeforeReady(false);
    }
    const tendermintReady = new Promise((resolve) =>
      tendermint.eventEmitter.once('ready', (status) => resolve(status))
    );
    await tendermint.connectWS();
    await tendermintReady;

    let role;
    if (!config.ndidNode) {
      logger.info({ message: 'Getting node role' });
      role = await node.getNodeRoleFromBlockchain();
      logger.info({ message: 'Node role', role });
    }

    await Promise.all([cacheDb.initialize(), longTermDb.initialize()]);
    await workerInitialize();

    workerEventEmitter.on('service_callback_url_changed', (newUrlObject) => {
      changeServiceCallbackUrlForWorker(newUrlObject);
    });
    workerEventEmitter.on('as_callback_url_changed', (newUrlObject) => {
      changeAsCallbackUrlForWorker(newUrlObject);
    });
    workerEventEmitter.on('idp_callback_url_changed', (newUrlObject) => {
      changeIdpCallbackUrlForWorker(newUrlObject);
    });
    workerEventEmitter.on('dpki_callback_url_changed', (dpkiObject) => {
      externalCryptoService.changeDpkiCallbackForWorker(dpkiObject);
    });
    workerEventEmitter.on('invalidateDataSchemaCache', (serviceId) => {
      invalidateDataSchemaCache(serviceId);
    });
    workerEventEmitter.on('invalidateNodesBehindProxyWithKeyOnProxyCache', () => {
      invalidateNodesBehindProxyWithKeyOnProxyCache();
    });
    workerEventEmitter.on('reInitKey', async () => {
      await nodeKey.initialize();
    });

    workerEventEmitter.on('callbackAfterBlockchain', async ({ fnName, argArray, gRPCRef }) => {
      processCallAndReturn({
        type: 'callbackAfterBlockchain', 
        fnName, argArray, gRPCRef,
        processFunction: common.getFunction(fnName),
        returnResultFunction: getClient().returnResult,
      });
    });
    
    workerEventEmitter.on('functionCall', async ({ namespace, fnName, argArray, gRPCRef }) => {
      processCallAndReturn({
        type: 'functionCall', 
        namespace, fnName, argArray, gRPCRef,
        processFunction: core[namespace][fnName],
        returnResultFunction: getClient().returnResult,
      });
    });

    if(!config.useExternalCryptoService) {
      await nodeKey.initialize();
    }
    logger.info({ message: 'Worker initialized' });

  } catch (error) {
    logger.error({
      message: 'Cannot initialize worker',
      error,
    });
    // shutDown();
  }
}

async function initializeMaster(standAlone) {
  logger.info({ message: 'Initializing server' });
  try {
    tendermint.loadSavedData();

    await Promise.all([cacheDb.initialize(), longTermDb.initialize()]);

    if (config.ndidNode) {
      tendermint.setWaitForInitEndedBeforeReady(false);
    }

    const tendermintReady = new Promise((resolve) =>
      tendermint.eventEmitter.once('ready', (status) => resolve(status))
    );

    await tendermint.connectWS();
    const tendermintStatusOnSync = await tendermintReady;

    let role;
    if (!config.ndidNode) {
      logger.info({ message: 'Getting node role' });
      role = await node.getNodeRoleFromBlockchain();
      logger.info({ message: 'Node role', role });
    }

    common.readCallbackUrlsFromFiles();
    if(!standAlone) masterInitialize();

    let externalCryptoServiceReady;
    if (config.useExternalCryptoService) {
      externalCryptoService.readCallbackUrlsFromFiles();
      if (!externalCryptoService.isCallbackUrlsSet()) {
        externalCryptoServiceReady = new Promise((resolve) =>
          externalCryptoService.eventEmitter.once('allCallbacksSet', () =>
            resolve()
          )
        );
      }
    } else {
      await nodeKey.initialize();
    }

    httpServer.initialize();

    if (externalCryptoServiceReady != null) {
      logger.info({ message: 'Waiting for DPKI callback URLs to be set' });
      await externalCryptoServiceReady;
    }

    if(!standAlone) {
      masterEventEmitter.on('tendermintCallByWorker', async ({ fnName, argArray, gRPCRef, workerId }) => {
        processCallAndReturn({
          type: 'tendermintCallByWorker', 
          fnName, argArray, gRPCRef,
          processFunction: tendermintNdid[fnName],
          returnResultFunction: tendermintReturnResult,
          workerId,
        });
      });

      masterEventEmitter.on('callbackToClientByWorker', ({ argArray }) => {
        logger.debug({
          message: 'callbackToClientByWorker',
          argArray
        });
        callbackToClient.apply(null, argArray);
      });

      masterEventEmitter.on('mqCallByWorker', ({ argArray }) => {
        logger.debug({
          message: 'mqCallByWorker',
          argArray
        });
        mq.send.apply(null, argArray);
      });
    }

    await common.initialize();
    if (role === 'rp' || role === 'idp' || role === 'as' || role === 'proxy') {
      await mq.initialize();
    }
    await tendermint.initialize();
    await common.resumeTimeoutScheduler();

    if (role === 'rp' || role === 'idp' || role === 'as' || role === 'proxy') {
      await common.setMessageQueueAddress();
      await mq.loadAndProcessBacklogMessages();
    }

    tendermint.processMissingBlocks(tendermintStatusOnSync);
    await tendermint.loadExpectedTxFromDB();
    tendermint.loadAndRetryBacklogTransactRequests();
    logger.info({ message: 'Server initialized' });

  } catch (error) {
    logger.error({
      message: 'Cannot initialize server',
      error,
    });
    // shutDown();
  }
}

const {
  privateKeyPassphrase, // eslint-disable-line no-unused-vars
  masterPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
  dbPassword, // eslint-disable-line no-unused-vars
  ...configToLog
} = config;
logger.info({
  message: 'Starting server',
  NODE_ENV: process.env.NODE_ENV,
  config: configToLog,
});

// Make sure data and log directories exist
mkdirp.sync(config.dataDirectoryPath);
mkdirp.sync(config.logDirectoryPath);

// Graceful Shutdown
let shutDownCalledOnce = false;
async function shutDown() {
  if (shutDownCalledOnce) {
    logger.error({
      message: 'Forcefully shutting down',
    });
    process.exit(1);
  }
  shutDownCalledOnce = true;

  logger.info({
    message: 'Received kill signal, shutting down gracefully',
  });
  console.log('(Ctrl+C again to force shutdown)');

  await httpServer.close();
  stopAllCallbackRetries();
  externalCryptoService.stopAllCallbackRetries();
  await mq.close();
  tendermint.tendermintWsClient.close();
  tendermintWsPool.closeAllConnections();
  // TODO: wait for async operations which going to use DB to finish before closing
  // a connection to DB
  // Possible solution: Have those async operations append a queue to use DB and
  // remove after finish using DB
  // => Wait here until a queue to use DB is empty
  await Promise.all([cacheDb.close(), longTermDb.close()]);
  common.stopAllTimeoutScheduler();
  if(config.isMaster) masterShutdown();
  else workerShutdown();
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

initialize();
