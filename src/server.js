import 'source-map-support/register';

import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';

import './envVarValidate';

import logger from './logger';

import routes from './routes';
import { init as idp_init } from './core/idp';
import { init as as_init } from './core/as';
import { init as rp_init, clearAllScheduler } from './core/rp';

import { close as closeDB } from './db';
import { tendermintWsClient } from './tendermint/ndid';
import { close as closeMQ } from './mq';
import { stopAllCallbackRetries } from './utils/callback';

import * as config from './config';

const env = process.env.NODE_ENV || 'development';

process.on('unhandledRejection', function(reason, p) {
  logger.error({
    message: 'Unhandled Rejection',
    p,
    reason: reason.stack || reason,
  });
});

logger.info({
  message: 'Starting server',
  env,
  config,
});

const app = express();

app.use(bodyParser.urlencoded({ extended: false, limit: '2mb' }));
app.use(bodyParser.json({ limit: '2mb' }));

app.use(morgan('combined'));
// app.use(morgan('dev'));

app.use(routes);

const server = http.createServer(app);
server.listen(config.serverPort);

logger.info({
  message: `Server listening on port ${config.serverPort}`,
});

// TO BE REMOVED
// Not needed in production environment
// It should be done in onboarding process
if (config.role === 'idp') {
  idp_init();
} else if (config.role === 'as') {
  as_init();
} else if (config.role === 'rp') {
  rp_init();
}

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
