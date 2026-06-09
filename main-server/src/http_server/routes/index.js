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

import { levels } from '../../logger';

import readyHandler from './middleware/ready_handler';
import loggingHandler from './middleware/logging_handler';
import errorHandler from './middleware/error_handler';
import apiKeyHandler from './middleware/api_key_handler';
import apiV4Router from './v4';
import { apiVersion as apiV4Version } from './v4/version';
import apiV5Router from './v5';
import { apiVersion as apiV5Version } from './v5/version';
import apiV6Router from './v6';
import { apiVersion as apiV6Version } from './v6/version';
import apiV7Router from './v7';
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

const logLevelDebugOrLower =
  levels.labels[config.logLevel] <= levels.labels.debug;

if (logLevelDebugOrLower) {
  router.use(loggingHandler);
}

router.use(apiKeyHandler);

if (config.env === 'development') {
  router.use('/debug', debugRouter);
}

router.get('/license', (req, res) => {
  const licenseText = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', '..', 'COPYING')
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
} else if (config.defaultApiVersion === apiV6Version) {
  router.use(apiV6Router);
} else {
  router.use(apiV7Router);
}
router.use('/v4', apiV4Router);
router.use('/v5', apiV5Router);
router.use('/v6', apiV6Router);
router.use('/v7', apiV7Router);

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
