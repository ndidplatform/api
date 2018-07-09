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

import logger from '../logger';

import readyHandler from './middleware/readyHandler';
import errorHandler from './middleware/errorHandler';
import ndidRouter from './ndid';
import apiV1Router from './v1';
import apiV2Router from './v2';
import getInfo from './info';

import * as config from '../config';

const router = express.Router();

// FOR DEBUG
if (config.env === 'development') {
  router.use((req, res, next) => {
    if (req.method === 'POST') {
      const { method, originalUrl, params, body } = req;
      logger.debug({
        message: 'Incoming HTTP',
        method,
        originalUrl,
        params,
        body,
      });
    }
    if (req.method === 'GET') {
      const { method, originalUrl, params, query } = req;
      logger.debug({
        message: 'Incoming HTTP',
        method,
        originalUrl,
        params,
        query,
      });
    }
    next();
  });
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

router.use(readyHandler);

if (config.role === 'ndid') {
  router.use('/ndid', ndidRouter);
}

router.use(apiV2Router);
router.use('/v1', apiV1Router);
router.use('/v2', apiV2Router);

router.get('/info', getInfo);

router.use(errorHandler);

// All other paths besides stated above are invalid
router.use('*', function(req, res) {
  res.status(404).end();
});

export default router;
