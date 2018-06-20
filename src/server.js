import 'source-map-support/register';

import fs from 'fs';
import http from 'http';
import https from 'https';
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';

import './envVarValidate';

import logger from './logger';

import routes from './routes';
import { bodyParserErrorHandler } from './routes/middleware/errorHandler';
import { clearAllScheduler } from './core/common';

import { close as closeDB } from './db';
import { tendermintWsClient } from './tendermint';
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
    cert: fs.readFileSync(config.httpsCertPath)
  };
  server = https.createServer(httpsOptions, app);
} else {
  server = http.createServer(app);
}
server.listen(config.serverPort);

logger.info({
  message: `${config.https ? 'HTTPS' : 'HTTP'} server listening on port ${config.serverPort}`,
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
