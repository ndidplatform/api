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
      } = req.body;

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
        },
        {
          synchronous: false,
          validateIdentifier: false,
          apiVersion,
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
      const resData = data.map((item) => {
        return {
          source_node_id: item.source_node_id,
          service_id: item.service_id,
          source_signature: item.source_signature,
          signature_sign_method: item.signature_signing_algorithm,
          data_salt: item.data_salt,
          data: item.data,
        };
      });
      res.status(200).json(resData);
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

    await common.closeRequest(
      {
        node_id,
        reference_id,
        callback_url,
        request_id,
      },
      { synchronous: false, apiVersion }
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

export default router;
