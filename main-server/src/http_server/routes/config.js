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
import * as telemetryToken from '../../telemetry/token';

const router = express.Router();

router.get('/', function (req, res, next) {
  try {
    const {
      privateKeyPassphrase, // eslint-disable-line no-unused-vars
      masterPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      signingPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      signingMasterPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      encryptionPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
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
    const {
      CALLBACK_API_VERSION,
      EXTERNAL_CRYPTO_SERVICE_CALLBACK_API_VERSION,
      AUTO_CLOSE_REQUEST_ON_COMPLETED,
      AUTO_CLOSE_REQUEST_ON_REJECTED,
      AUTO_CLOSE_REQUEST_ON_COMPLICATED,
      AUTO_CLOSE_REQUEST_ON_ERRORED,
    } = req.body;

    if (CALLBACK_API_VERSION != null) {
      config.callbackApiVersion = CALLBACK_API_VERSION;
    }
    if (EXTERNAL_CRYPTO_SERVICE_CALLBACK_API_VERSION != null) {
      config.externalCryptoServiceCallbackApiVersion =
        EXTERNAL_CRYPTO_SERVICE_CALLBACK_API_VERSION;
    }
    if (AUTO_CLOSE_REQUEST_ON_COMPLETED != null) {
      config.autoCloseRequestOnCompleted = AUTO_CLOSE_REQUEST_ON_COMPLETED;
    }
    if (AUTO_CLOSE_REQUEST_ON_REJECTED != null) {
      config.autoCloseRequestOnRejected = AUTO_CLOSE_REQUEST_ON_REJECTED;
    }
    if (AUTO_CLOSE_REQUEST_ON_COMPLICATED != null) {
      config.autoCloseRequestOnComplicated = AUTO_CLOSE_REQUEST_ON_COMPLICATED;
    }
    if (AUTO_CLOSE_REQUEST_ON_ERRORED != null) {
      config.autoCloseRequestOnErrored = AUTO_CLOSE_REQUEST_ON_ERRORED;
    }

    const {
      privateKeyPassphrase, // eslint-disable-line no-unused-vars
      masterPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      signingPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      signingMasterPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      encryptionPrivateKeyPassphrase, // eslint-disable-line no-unused-vars
      dbPassword, // eslint-disable-line no-unused-vars
      ...configNoCredential
    } = config;

    res.status(200).json(configNoCredential);
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/telemetry/reissue_token', async (req, res, next) => {
  try {
    if (config.telemetryLoggingEnabled) {
      await telemetryToken.reissueToken();
      res.status(200).end();
    } else {
      res.status(404).json({
        message: 'Telemetry module is not enabled',
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
