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

import { validateBody } from '../middleware/validation';
import { rpOnlyHandler } from '../middleware/role_handler';
import * as rp from '../../../core/rp';
import * as common from '../../../core/common';

import { apiVersion } from './version';
import { HTTP_HEADER_FIELDS } from './private_http_header';

const router = express.Router();

router.use(rpOnlyHandler);

router.post(
  '/requests/:namespace/:identifier',
  validateBody,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const {
        node_id,
        reference_id,
        callback_url,
        mode,
        idp_id_list,
        data_request_list,
        request_message,
        min_ial,
        min_aal,
        min_idp,
        request_timeout,
        bypass_identity_check,
        initial_salt,
      } = req.body;
      const {
        [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
        [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
      } = req.headers;

      const result = await common.createRequest(
        {
          node_id,
          mode,
          namespace,
          identifier,
          reference_id,
          idp_id_list,
          callback_url,
          data_request_list,
          request_message,
          min_ial,
          min_aal,
          min_idp,
          request_timeout,
          bypass_identity_check,
          initial_salt,
        },
        {
          synchronous: false,
          apiVersion,
          ndidMemberAppType,
          ndidMemberAppVersion,
        }
      );

      res.status(202).json(result);
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/request_references/:reference_id', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { reference_id } = req.params;

    const requestId = await rp.getRequestIdByReferenceId(node_id, reference_id);
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

router.get('/request_data/:request_id', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { request_id } = req.params;

    const data = await rp.getDataFromAS(node_id, request_id);
    if (data != null) {
      res.status(200).json(data);
    } else {
      res.status(404).end();
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/request_data_removal', async (req, res, next) => {
  try {
    const { node_id } = req.body;
    await rp.removeAllDataFromAS(node_id);
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/request_data_removal/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;
    const { node_id } = req.body;

    await rp.removeDataFromAS(node_id, request_id);
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/request_close', validateBody, async (req, res, next) => {
  try {
    const { node_id, reference_id, callback_url, request_id } = req.body;
    const {
      [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
      [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
    } = req.headers;

    await common.closeRequest(
      {
        node_id,
        reference_id,
        callback_url,
        request_id,
      },
      {
        synchronous: false,
        apiVersion,
        ndidMemberAppType,
        ndidMemberAppVersion,
      }
    );
    res.status(202).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/callback', async (req, res, next) => {
  try {
    const urls = await rp.getCallbackUrls();

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
    const { error_url } = req.body;

    await rp.setCallbackUrls({
      error_url,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/message',
  validateBody,
  async (req, res, next) => {
    try {
      const {
        node_id,
        reference_id,
        message,
        purpose,
        initial_salt,
        hash_message,
      } = req.body;

      const result = await common.createMessage(
        {
          node_id,
          reference_id,
          message,
          purpose,
          initial_salt,
          hash_message,
        },
        { synchronous: false }
      );

      res.status(202).json(result);
      next();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
