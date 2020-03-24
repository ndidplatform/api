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

import { validateBody, validateQuery } from '../middleware/validation';
import { idpOnlyHandler } from '../middleware/role_handler';
import * as idp from '../../../core/idp';

const router = express.Router();

router.use(idpOnlyHandler);

router.get('/callback', async (req, res, next) => {
  try {
    const urls = await idp.getCallbackUrls();

    if (Object.keys(urls).length > 0) {
      res.status(200).json(urls);
    } else {
      res.status(404).end();
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/callback', validateBody, async (req, res, next) => {
  try {
    const {
      incoming_request_url,
      incoming_request_status_update_url,
      identity_modification_notification_url,
      error_url,
    } = req.body;

    await idp.setCallbackUrls({
      incoming_request_url,
      incoming_request_status_update_url,
      identity_modification_notification_url,
      error_url,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/response', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      reference_id,
      callback_url,
      request_id,
      //namespace,
      //identifier,
      ial,
      aal,
      status,
      accessor_id,
      signature,
    } = req.body;

    await idp.createResponse(
      {
        node_id,
        reference_id,
        callback_url,
        request_id,
        //namespace,
        //identifier,
        ial,
        aal,
        status,
        accessor_id,
        signature,
      },
      { synchronous: false }
    );

    res.status(202).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/error_response', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      reference_id,
      callback_url,
      error_code, 
      request_id,
    } = req.body;

    await idp.createErrorResponse(
      {
        node_id,
        reference_id,
        callback_url,
        request_id,
        //namespace,
        //identifier,
        status,
        error_code,
      },
      { synchronous: false }
    );

    res.status(202).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.get(
  '/request_message_padded_hash',
  validateQuery,
  async (req, res, next) => {
    try {
      const { node_id, request_id, accessor_id } = req.query;

      const request_message_padded_hash = await idp.getRequestMessagePaddedHash(
        {
          node_id,
          request_id,
          accessor_id,
        }
      );

      res.status(200).json({
        request_message_padded_hash,
      });
      next();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
