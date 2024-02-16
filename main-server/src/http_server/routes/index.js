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

import path from 'path';
import fs from 'fs';
import express from 'express';

import logger from '../../logger';

import readyHandler from './middleware/ready_handler';
import errorHandler from './middleware/error_handler';
import apiKeyHandler from './middleware/api_key_handler';
import apiV4Router from './v4';
import { apiVersion as apiV4Version } from './v4/version';
import apiV5Router from './v5';
import { apiVersion as apiV5Version } from './v5/version';
import apiV6Router from './v6';
import serverInfo from './server_info';
import configRouter from './config';
import reinitNodeKeys from './reinit_node_keys';
import {
  setHttpRequestStartTime,
  collectHttpRequestDuration,
} from '../../prometheus';
import debugRouter from './debug';

import * as config from '../../config';

const router = express.Router();

// FOR DEBUG
if (config.env === 'development') {
  router.use((req, res, next) => {
    const { method, originalUrl, params, query, body } = req;
    logger.debug({
      message: 'Incoming HTTP request',
      method,
      originalUrl,
      params,
      query,
      body,
    });

    const end = res.end;
    res.end = function (chunk, encoding) {
      res.end = end;
      res.end(chunk, encoding);

      const isJSON =
        res.getHeaders() &&
        res.getHeaders()['content-type'] &&
        res.getHeaders()['content-type'].indexOf('json') >= 0;

      const responseBodyString = chunk && chunk.toString();
      let responseBody;
      if (isJSON) {
        try {
          responseBody = JSON.parse(responseBodyString);
        } catch (error) {
          responseBody = responseBodyString;
        }
      }

      logger.debug({
        message: 'Outgoing HTTP response',
        method,
        originalUrl,
        status: res.statusCode,
        body: responseBody,
      });
    };

    next();
  });
}

router.use(apiKeyHandler);

if (config.env === 'development') {
  router.use('/debug', debugRouter);
}

router.get('/license', (req, res) => {
  const licenseText = fs.readFileSync(
    path.join(__dirname, '..', '..', 'COPYING')
  );
  res.set('Content-Type', 'text/plain');
  res.status(200).send(licenseText);
});

router.get('/source', (req, res) => {
  res.status(200).send('https://github.com/ndidplatform/api');
});

router.use(serverInfo);
if (config.enableConfigHttpRoutePath) {
  router.use('/config', configRouter);
}

// Prometheus
if (config.prometheusEnabled) {
  router.use(setHttpRequestStartTime);
}

router.get('/reinit_node_keys', reinitNodeKeys);

router.use(readyHandler);

if (config.defaultApiVersion === apiV4Version) {
  router.use(apiV4Router);
} else if (config.defaultApiVersion === apiV5Version) {
  router.use(apiV5Router);
} else {
  router.use(apiV6Router);
}
router.use('/v4', apiV4Router);
router.use('/v5', apiV5Router);
router.use('/v6', apiV6Router);

router.use(errorHandler);

// Prometheus
if (config.prometheusEnabled) {
  router.use(collectHttpRequestDuration);
}

// All other paths besides stated above are invalid
router.use('*', function (req, res) {
  if (!res.headersSent) {
    res.status(404).end();
  }
});

export default router;
