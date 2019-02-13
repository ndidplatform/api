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
import ndidRouter from './ndid';
import apiV1Router from './v1';
import apiV2Router from './v2';
import serverInfo from './server_info';
import reinitNodeKeys from './reinit_node_keys';
import prometheusRouter, {
  setHttpRequestStartTime,
  collectHttpRequestDuration,
} from './prometheus';
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
    res.end = function(chunk, encoding) {
      res.end = end;
      res.end(chunk, encoding);

      const isJSON =
        res._headers &&
        res._headers['content-type'] &&
        res._headers['content-type'].indexOf('json') >= 0;

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

// Prometheus
router.use(setHttpRequestStartTime);
router.use(prometheusRouter);

router.get('/reinit_node_keys', reinitNodeKeys);

router.use(readyHandler);

router.use('/ndid', ndidRouter);

router.use(apiV2Router);
router.use('/v1', apiV1Router);
router.use('/v2', apiV2Router);

router.use(errorHandler);

// Prometheus
router.use(collectHttpRequestDuration);

// All other paths besides stated above are invalid
router.use('*', function(req, res) {
  if (!res.headersSent) {
    res.status(404).end();
  }
});

export default router;
