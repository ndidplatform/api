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

import express from 'express';

import { validateBody } from './middleware/validation';

import * as config from '../../config';
import PMSLogger from '../../pms';

const router = express.Router();

router.get('/', function (req, res, next) {
  try {
    const {
      privateKeyPassphrase, // eslint-disable-line no-unused-vars
      masterPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      dbPassword, // eslint-disable-line no-unused-vars
      ...configNoCredential
    } = config;

    res.status(200).json(configNoCredential);
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/set', validateBody, function (req, res, next) {
  try {
    const { CALLBACK_API_VERSION } = req.body;

    config.callbackApiVersion = CALLBACK_API_VERSION;

    const {
      privateKeyPassphrase, // eslint-disable-line no-unused-vars
      masterPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      dbPassword, // eslint-disable-line no-unused-vars
      ...configNoCredential
    } = config;

    res.status(200).json(configNoCredential);
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/pms/reissue_token', async (req, res, next) => {
  try {
    if (config.PMSLoggingEnabled) {
      await PMSLogger.reissue_token();
      res.status(200).end();
    } else {
      res.status(404).json({
        message: "PMS module is not enabled",
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
