import fs from 'fs';
import http from 'http';
import https from 'https';
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';

import routes from './routes';
import { bodyParserErrorHandler } from './routes/middleware/error_handler';

import logger from './logger';

import * as config from './config';

let server;

export function initialize() {
  const app = express();

  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );

  app.use(bodyParser.json({ limit: '3mb' }));
  app.use(bodyParserErrorHandler);

  app.use(routes);

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
}

export function close() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        logger.info({
          message: 'HTTP server closed',
        });
        resolve();
      });
    } else {
      resolve();
    }
  });
}
