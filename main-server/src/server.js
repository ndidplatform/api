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
import * as coreCommon from './core/common';
import * as rp from './core/rp';
import * as idp from './core/idp';
import * as as from './core/as';
import * as proxy from './core/proxy';
import * as requestProcessManager from './core/request_process_manager';
import * as nodeCallback from './core/node_callback';
import * as nodeKey from './utils/node_key';
import { getFunction } from './functions';

import * as cacheDb from './db/cache';
import * as longTermDb from './db/long_term';
import * as dataDb from './db/data';
import * as telemetryDb from './db/telemetry';
import * as telemetryEventsDb from './db/telemetry_events';
import * as tendermint from './tendermint';
import * as tendermintWsPool from './tendermint/ws_pool';
import * as mq from './mq';
import * as callbackUtil from './callback';
import * as externalCryptoService from './external_crypto_service';
import * as jobMaster from './master-worker-interface/server';
import * as jobWorker from './master-worker-interface/client';
import * as prometheus from './prometheus';
import * as telemetryToken from './telemetry/token';

import logger, { setOptionalErrorLogFn } from './logger';

import TelemetryLogger from './telemetry';

import { version } from './version';
import MODE from './mode';
import ROLE from './role';
import * as config from './config';

process.on('unhandledRejection', function (reason, p) {
  if (reason && reason.name === 'CustomError') {
    logger.error({
      message: 'Unhandled Rejection',
      p,
    });
    logger.error({ err: reason });
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
    tendermint.loadSavedData();

    await Promise.all([
      cacheDb.initialize(),
      longTermDb.initialize(),
      dataDb.initialize(),
    ]);

    if (config.prometheusEnabled) {
      prometheus.initialize();
    }

    if (!config.ndidNode) {
      if (config.telemetryLoggingEnabled) {
        telemetryDb.initialize();
        telemetryEventsDb.initialize();

        setOptionalErrorLogFn((log) => {
          TelemetryLogger.logProcessLog({
            nodeId: config.nodeId,
            process_name: 'main',
            log,
          });
        });
      }
    }

    if (config.ndidNode) {
      tendermint.setWaitForInitEndedBeforeReady(false);
    }
    tendermint.setTxResultCallbackFnGetter(getFunction);

    const tendermintReady = new Promise((resolve) =>
      tendermint.eventEmitter.once('ready', (status) => resolve(status))
    );

    if (!config.ndidNode) {
      tendermint.setTelemetryEnabled(
        (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) &&
          config.telemetryLoggingEnabled
      );
    }

    await tendermint.connectWS();
    const tendermintStatusOnSync = await tendermintReady;

    let role;
    if (!config.ndidNode) {
      logger.info({ message: 'Getting node role' });
      role = await node.getNodeRoleFromBlockchain();
      logger.info({ message: 'Node role', role });
    }

    if (role === ROLE.RP) {
      if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
        mq.setMessageHandlerFunction(rp.handleMessageFromQueue);
        tendermint.setTendermintNewBlockEventHandler(
          rp.handleTendermintNewBlock
        );
      }
      await rp.checkCallbackUrls();
    } else if (role === ROLE.IDP) {
      if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
        mq.setMessageHandlerFunction(idp.handleMessageFromQueue);
        tendermint.setTendermintNewBlockEventHandler(
          idp.handleTendermintNewBlock
        );
      }
      await idp.checkCallbackUrls();
    } else if (role === ROLE.AS) {
      if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
        mq.setMessageHandlerFunction(as.handleMessageFromQueue);
        tendermint.setTendermintNewBlockEventHandler(
          as.handleTendermintNewBlock
        );
      }

      await as.checkCallbackUrls();
    } else if (role === ROLE.PROXY) {
      if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
        mq.setMessageHandlerFunction(proxy.handleMessageFromQueue);
        tendermint.setTendermintNewBlockEventHandler(
          proxy.handleTendermintNewBlock
        );
      }
      await rp.checkCallbackUrls();
      await idp.checkCallbackUrls();
      await as.checkCallbackUrls();
    }
    if (
      role === ROLE.RP ||
      role === ROLE.IDP ||
      role === ROLE.AS ||
      role === ROLE.PROXY
    ) {
      await nodeCallback.checkCallbackUrls();
    }

    callbackUtil.setShouldRetryFnGetter(getFunction);
    callbackUtil.setResponseCallbackFnGetter(getFunction);

    let externalCryptoServiceReady;
    if (config.useExternalCryptoService) {
      await externalCryptoService.checkCallbackUrls();
      if (!(await externalCryptoService.isCallbackUrlsSet())) {
        externalCryptoServiceReady = new Promise((resolve) =>
          externalCryptoService.eventEmitter.once('allCallbacksSet', () =>
            resolve()
          )
        );
      }
    } else {
      await nodeKey.initialize();
    }

    if (config.mode === MODE.MASTER) {
      await jobMaster.initialize();
      logger.info({ message: 'Waiting for available worker' });
      await new Promise((resolve) =>
        jobMaster.eventEmitter.once('worker_connected', () => resolve())
      );
    } else if (config.mode === MODE.WORKER) {
      await jobWorker.initialize();
    }

    if (config.mode === MODE.STANDALONE || config.mode === MODE.WORKER) {
      httpServer.initialize();
    }

    if (externalCryptoServiceReady != null) {
      logger.info({ message: 'Waiting for DPKI callback URLs to be set' });
      await externalCryptoServiceReady;
    }

    if (config.telemetryLoggingEnabled && !config.ndidNode) {
      if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
        await telemetryToken.initialize({ role });
      }
    }

    if (
      role === ROLE.RP ||
      role === ROLE.IDP ||
      role === ROLE.AS ||
      role === ROLE.PROXY
    ) {
      mq.setErrorHandlerFunction(
        coreCommon.getHandleMessageQueueErrorFn(() => {
          if (role === ROLE.RP) {
            return 'rp.getErrorCallbackUrl';
          } else if (role === ROLE.IDP) {
            return 'idp.getErrorCallbackUrl';
          } else if (role === ROLE.AS) {
            return 'as.getErrorCallbackUrl';
          } else if (role === ROLE.PROXY) {
            return 'proxy.getErrorCallbackUrl';
          }
        })
      );
      if (config.mode === MODE.STANDALONE) {
        await mq.initialize({
          telemetryEnabled: config.telemetryLoggingEnabled,
        });
      } else if (config.mode === MODE.MASTER) {
        await mq.initializeInbound({
          telemetryEnabled: config.telemetryLoggingEnabled,
        });
      } else if (config.mode === MODE.WORKER) {
        await mq.initializeOutbound({
          sendSavedPendingMessages: false,
          telemetryEnabled: false,
        });
      }
    }

    await tendermint.initialize();

    if (role === ROLE.RP || role === ROLE.IDP || role === ROLE.PROXY) {
      let nodeIds;
      if (role === ROLE.RP) {
        nodeIds = [config.nodeId];
      } else if (role === ROLE.IDP) {
        nodeIds = [config.nodeId];
      } else if (role === ROLE.PROXY) {
        const nodesBehindProxy = await node.getNodesBehindProxyWithKeyOnProxy();
        nodeIds = nodesBehindProxy.map((node) => node.node_id);
      }
      if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
        await coreCommon.resumeTimeoutScheduler(nodeIds);
      }
    }

    if (
      role === ROLE.RP ||
      role === ROLE.IDP ||
      role === ROLE.AS ||
      role === ROLE.PROXY
    ) {
      if (config.mode === MODE.STANDALONE || config.mode === MODE.WORKER) {
        await coreCommon.setMessageQueueAddress();
      }
      if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
        await mq.loadAndProcessBacklogMessages();
      }
    }

    if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
      tendermint.processMissingBlocks(tendermintStatusOnSync);
      await tendermint.loadExpectedTxFromDB();
      tendermint.loadAndRetryBacklogTransactRequests();
      tendermint.loadAndRetryTransact();

      callbackUtil.resumeCallbackToClient();
    }

    logger.info({ message: 'Server initialized' });

    if (!config.ndidNode) {
      if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
        TelemetryLogger.logMainVersion({ nodeId: config.nodeId, version });
      }
    }
  } catch (error) {
    logger.error({
      message: 'Cannot initialize server',
      err: error,
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
  version,
  NODE_ENV: process.env.NODE_ENV,
  config: configToLog,
});

// Make sure data and log directories exist
mkdirp.sync(config.dataDirectoryPath);
// mkdirp.sync(config.logDirectoryPath);

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
  callbackUtil.stopAllCallbackRetries();
  externalCryptoService.stopAllCallbackRetries();
  coreCommon.stopAllTimeoutScheduler();

  if (config.mode === MODE.MASTER) {
    jobMaster.shutdown();
  } else if (config.mode === MODE.WORKER) {
    await jobWorker.shutdown();
  }

  // Wait for async operations which going to use TM/MQ/DB to finish before
  // closing connections
  await requestProcessManager.stop();

  await mq.close();
  tendermint.tendermintWsClient.close();
  tendermintWsPool.closeAllConnections();

  await prometheus.stop();

  await Promise.all([cacheDb.close(), longTermDb.close(), dataDb.close()]);

  if (!config.ndidNode) {
    if (config.telemetryLoggingEnabled) {
      await telemetryDb.close();
      await telemetryEventsDb.close();
    }
  }
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

initialize();
