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

import fs from 'fs';
import http from 'http';
import https from 'https';
import express from 'express';
import morgan from 'morgan';

import routes from './routes';

import logger from '../../logger';

import * as config from '../../config';

let server;

export function initialize() {
  logger.info({
    message: 'Starting Prometheus metrics HTTP server',
  });

  const app = express();

  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.info({ message: message.trim() }) },
    })
  );

  app.use(routes);

  if (config.prometheusHttps) {
    const httpsOptions = {
      key: fs.readFileSync(config.prometheusHttpsKeyPath),
      cert: fs.readFileSync(config.prometheusHttpsCertPath),
    };
    server = https.createServer(httpsOptions, app);
  } else {
    server = http.createServer(app);
  }
  server.listen(config.prometheusServerPort, () => {
    logger.info({
      message: `Prometheus metrics ${
        config.prometheusHttps ? 'HTTPS' : 'HTTP'
      } server listening on port ${config.prometheusServerPort}`,
    });
  });
}

export function close() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        logger.info({
          message: `Prometheus metrics ${
            config.prometheusHttps ? 'HTTPS' : 'HTTP'
          } server closed`,
        });
        resolve();
      });
    } else {
      resolve();
    }
  });
}
