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
import * as core from './core/common';
import * as nodeKey from './utils/node_key';

import * as cacheDb from './db/cache';
import * as longTermDb from './db/long_term';
import * as tendermint from './tendermint';
import * as mq from './mq';
import { stopAllCallbackRetries } from './utils/callback';
import * as externalCryptoService from './utils/external_crypto_service';

import logger from './logger';

import * as config from './config';

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
  logger.info({ message: 'Initializing server' });
  try {
    await Promise.all([cacheDb.initialize(), longTermDb.initialize()]);

    let role;
    if (!config.skipGetRole) {
      logger.info({ message: 'Getting node role' });
      role = await node.getNodeRoleFromBlockchain();
      logger.info({ message: 'Node role', role });
    }

    let externalCryptoServiceReady;
    if (config.useExternalCryptoService) {
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

    const tendermintReady = new Promise((resolve) =>
      tendermint.eventEmitter.once('ready', () => resolve())
    );

    await core.initialize();

    await tendermint.initialize();
    await tendermintReady;

    if (role === 'rp' || role === 'idp' || role === 'as' || role === 'proxy') {
      await core.registerMessageQueueAddress();
      await mq.initialize();
      await mq.loadAndProcessBacklogMessages();
    }

    await tendermint.loadExpectedTxFromDB();

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
  mq.close();
  tendermint.tendermintWsClient.close();
  // TODO: wait for async operations which going to use DB to finish before closing
  // a connection to DB
  // Possible solution: Have those async operations append a queue to use DB and
  // remove after finish using DB
  // => Wait here until a queue to use DB is empty
  await Promise.all([cacheDb.close(), longTermDb.close()]);
  core.stopAllTimeoutScheduler();
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

initialize();
