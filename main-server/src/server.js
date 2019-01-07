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

import { changeAccessorUrlForWorker } from './core/idp/index';
import { invalidateDataSchemaCache } from './core/as/data_validator';

import logger from './logger';

import * as config from './config';
import { 
  eventEmitter as masterEventEmitter, 
  initialize as masterInitialize,
  tendermintReturnResult, 
} from './master-worker-interface/server';
import { 
  eventEmitter as workerEventEmitter,
  initialize as workerInitialize
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

async function initialize() {
  if(config.isMaster) initializeMaster();
  else initializeWorker();
}

async function initializeWorker() {
  logger.info({ message: 'Initializing worker' });
  try {
    //connect to tendermint for query only
    if (config.ndidNode) {
      tendermint.setWaitForInitEndedBeforeReady(false);
    }
    const tendermintReady = new Promise((resolve) =>
      tendermint.eventEmitter.once('ready', (status) => resolve(status))
    );
    await tendermint.connectWS();
    await tendermintReady;

    await Promise.all([cacheDb.initialize(), longTermDb.initialize()]);
    await workerInitialize();
    workerEventEmitter.on('accessor_sign_changed', (newUrl) => {
      changeAccessorUrlForWorker(newUrl);
    });
    workerEventEmitter.on('dpki_callback_url_changed', (dpkiObject) => {
      externalCryptoService.changeDpkiCallbackForWorker(dpkiObject);
    });
    workerEventEmitter.on('invalidateDataSchemaCache', (serviceId) => {
      invalidateDataSchemaCache(serviceId);
    });
    workerEventEmitter.on('reInitKey', async () => {
      await nodeKey.initialize();
    });

    workerEventEmitter.on('callbackAfterBlockchain', ({ fnName, argArray }) => {
      logger.debug({
        message: 'callbackAfterBlockchain',
        fnName,
        argArray
      });
      common.getFunction(fnName)(...argArray);
    });
    workerEventEmitter.on('functionCall', async ({ namespace, fnName, argArray, gRPCRef }) => {
      logger.debug({
        message: 'functionCall',
        namespace,
        fnName,
        argArray,
        gRPCRef
      });
      try {
        let result = await core[namespace][fnName].apply(null, argArray);
        if(gRPCRef !== '') {
          await getClient().returnResult({
            gRPCRef,
            result: JSON.stringify(result || null),
            error: JSON.stringify(null),
          });
        }
      } catch(error) {
        logger.error({
          message: 'functionCall error',
          namespace,
          fnName,
          error,
        });
        let errorSend = {};
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
        else errorSend = error;
        if(gRPCRef !== '') {
          await getClient().returnResult({
            gRPCRef,
            result: JSON.stringify(null),
            error: JSON.stringify(errorSend),
          });
        } else throw error;
      }
    });

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

    if (externalCryptoServiceReady != null) {
      logger.info({ message: 'Waiting for DPKI callback URLs to be set' });
      await externalCryptoServiceReady;
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

async function initializeMaster() {
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

    masterInitialize();
    masterEventEmitter.on('tendermintCallByWorker', async ({ fnName, argArray, gRPCRef }) => {
      logger.debug({
        message: 'tendermintCallByWorker',
        fnName,
        argArray,
        gRPCRef,
      });
      try {
        let result = await tendermintNdid[fnName].apply(null, argArray);
        if(gRPCRef !== '') {
          await tendermintReturnResult({
            gRPCRef,
            result: JSON.stringify(result || null),
            error: JSON.stringify(null),
          });
        }
      } catch(error) {
        logger.error({
          message: 'tendermintCall error',
          fnName,
          error,
          gRPCRef,
        });
        let errorSend = {};
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
        else errorSend = error;
        if(gRPCRef !== '') {
          await tendermintReturnResult({
            gRPCRef,
            result: JSON.stringify(null),
            error: JSON.stringify(errorSend),
          });
        } else throw error;
      }
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
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

initialize();
