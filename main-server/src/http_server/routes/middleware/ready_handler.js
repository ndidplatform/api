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

import * as tendermint from '../../../tendermint';
import { isMqAddressesSet } from '../../../core/common';
import { isCallbackUrlsSet } from '../../../utils/external_crypto_service';
import { role } from '../../../node';

import errorType from 'ndid-error/type';

import logger from '../../../logger';

import * as config from '../../../config';

export default function readyHandler(req, res, next) {
  // TODO: Return 503 with server init failed error if server init failed

  if (req.url.endsWith('/dpki/node/callback')) {
    next();
    return;
  }

  // Reject all requests when tendermint is not yet ready.
  // This includes when tendermint is syncing (happens when starting a new node or resuming tendermint)

  if (tendermint.connected !== true) {
    const responseBody = {
      error: {
        message: errorType.TENDERMINT_NOT_CONNECTED.message,
        code: errorType.TENDERMINT_NOT_CONNECTED.code,
      },
    };
    res.status(503).json(responseBody);
    logger.error({
      message: 'Responded Service Unavailable with HTTP code 503',
      responseBody,
    });
    return;
  }

  if (tendermint.syncing == null || tendermint.syncing === true) {
    const responseBody = {
      error: {
        message: errorType.TENDERMINT_SYNCING.message,
        code: errorType.TENDERMINT_SYNCING.code,
      },
    };
    res.status(503).json(responseBody);
    logger.error({
      message: 'Responded Service Unavailable with HTTP code 503',
      responseBody,
    });
    return;
  }

  if (req.method === 'POST') {
    if (config.useExternalCryptoService && !isCallbackUrlsSet()) {
      const responseBody = {
        error: {
          message: errorType.WAITING_FOR_DPKI_CALLBACK_URL_SET.message,
          code: errorType.WAITING_FOR_DPKI_CALLBACK_URL_SET.code,
        },
      };
      res.status(503).json(responseBody);
      logger.error({
        message: 'Responded Service Unavailable with HTTP code 503',
        responseBody,
      });
      return;
    }

    // Reject all POST calls while message queue address is being registered
    if (role != null && role !== 'ndid' && !isMqAddressesSet()) {
      const responseBody = {
        error: {
          message: errorType.REGISTERING_MESSAGE_QUEUE_ADDRESS.message,
          code: errorType.REGISTERING_MESSAGE_QUEUE_ADDRESS.code,
        },
      };
      res.status(503).json(responseBody);
      logger.error({
        message: 'Responded Service Unavailable with HTTP code 503',
        responseBody,
      });
      return;
    }

    if (!tendermint.expectedTxsLoaded) {
      const responseBody = {
        error: {
          message: errorType.LOADING_EXPECTED_TXS_CACHE.message,
          code: errorType.LOADING_EXPECTED_TXS_CACHE.code,
        },
      };
      res.status(503).json(responseBody);
      logger.error({
        message: 'Responded Service Unavailable with HTTP code 503',
        responseBody,
      });
      return;
    }
  }

  next();
}
