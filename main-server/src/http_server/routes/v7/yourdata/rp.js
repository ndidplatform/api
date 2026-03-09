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

import { validateBody } from '../../middleware/validation';
import { rpOnlyHandler } from '../../middleware/role_handler';
import * as coreYourDataRP from '../../../../core/yourdata/rp';

import { apiVersion } from '../version';
import { HTTP_HEADER_FIELDS } from '../private_http_header';

const router = express.Router();

router.use(rpOnlyHandler);

router.post('/requests', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      service_id,
      service_version,
      service_extension,
      as_node_id,
      reference_id,
      callback_url,
      namespace,
      identifier,
      request_params,
      authorization,
      request_timeout,
    } = req.body;
    const {
      [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
      [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
    } = req.headers;

    const result = await coreYourDataRP.createRequest(
      {
        node_id,
        service_id,
        service_version,
        service_extension,
        as_node_id,
        reference_id,
        callback_url,
        namespace,
        identifier,
        request_params,
        authorization,
        request_timeout,
      },
      {
        apiVersion,
        ndidMemberAppType,
        ndidMemberAppVersion,
      }
    );

    res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/request_references/:reference_id', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { reference_id } = req.params;

    const requestId = await coreYourDataRP.getRequestIdByReferenceId(
      node_id,
      reference_id
    );
    if (requestId != null) {
      res.status(200).json({ request_id: requestId });
    } else {
      res.status(404).end();
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/data_decryption_key_retry_requests',
  validateBody,
  async (req, res, next) => {
    try {
      const {
        node_id,
        request_id,
        reference_id,
        callback_url,
        request_timeout,
      } = req.body;
      const {
        [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
        [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
      } = req.headers;

      await coreYourDataRP.createDataDecryptionKeyRetryRequest(
        {
          node_id,
          request_id,
          reference_id,
          callback_url,
          request_timeout,
        },
        {
          apiVersion,
          ndidMemberAppType,
          ndidMemberAppVersion,
        }
      );

      res.status(204).end();

      next();
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/data_decryption_key_retry_request_references/:reference_id',
  async (req, res, next) => {
    try {
      const { node_id } = req.query;
      const { reference_id } = req.params;

      const requestId =
        await coreYourDataRP.getDataDecryptionKeyRetryRequestIdByReferenceId(
          node_id,
          reference_id
        );
      if (requestId != null) {
        res.status(200).json({ request_id: requestId });
      } else {
        res.status(404).end();
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/request_data/:request_id', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { request_id } = req.params;

    const result = await coreYourDataRP.getDataFromAS(node_id, request_id);
    if (result != null) {
      res.status(200).json(result);
    } else {
      res.status(404).end();
    }

    next();
  } catch (error) {
    next(error);
  }
});

router.post('/request_data_removal', validateBody, async (req, res, next) => {
  try {
    const { node_id } = req.body;

    await coreYourDataRP.removeAllDataFromAS(node_id);

    res.status(204).end();

    next();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/request_data_removal/:request_id',
  validateBody,
  async (req, res, next) => {
    try {
      const { request_id } = req.params;
      const { node_id } = req.body;

      await coreYourDataRP.removeDataFromAS(node_id, request_id);

      res.status(204).end();

      next();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
