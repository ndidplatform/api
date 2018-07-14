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

import fs from 'fs';
import http from 'http';
import https from 'https';
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import mkdirp from 'mkdirp';

import './env_var_validate';

import logger from './logger';

import routes from './routes';
import { bodyParserErrorHandler } from './routes/middleware/error_handler';
import { clearAllScheduler } from './core/common';

import { close as closeDB } from './db';
import { tendermintWsClient } from './tendermint';
import { close as closeMQ } from './mq';
import { stopAllCallbackRetries } from './utils/callback';

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

const app = express();

app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParserErrorHandler);

app.use(routes);

let server;
if (config.https) {
  const httpsOptions = {
    key: fs.readFileSync(config.httpsKeyPath),
    cert: fs.readFileSync(config.httpsCertPath),
  };
  server = https.createServer(httpsOptions, app);
} else {
  server = http.createServer(app);
}
server.listen(config.serverPort);

logger.info({
  message: `${config.https ? 'HTTPS' : 'HTTP'} server listening on port ${
    config.serverPort
  }`,
});

// Graceful Shutdown
let shutDownCalledOnce = false;
function shutDown() {
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

  server.close(async () => {
    logger.info({
      message: 'HTTP server closed',
    });

    stopAllCallbackRetries();
    closeMQ();
    tendermintWsClient.close();
    // TODO: wait for async operations which going to use DB to finish before closing
    // a connection to DB
    // Possible solution: Have those async operations append a queue to use DB and
    // remove after finish using DB
    // => Wait here until a queue to use DB is empty
    await closeDB();
    clearAllScheduler();
  });
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

// For testing
module.exports = server;
