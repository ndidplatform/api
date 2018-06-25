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
import * as rp from '../../core/rp';
import * as common from '../../core/common';

const router = express.Router();

router.post(
  '/requests/:namespace/:identifier',
  validateBody,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const {
        mode,
        reference_id,
        idp_id_list,
        callback_url,
        data_request_list,
        request_message,
        min_ial,
        min_aal,
        min_idp,
        request_timeout,
      } = req.body;

      const requestId = await common.createRequest({
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
      });

      res.status(200).json({ request_id: requestId });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/requests/reference/:reference_number', async (req, res, next) => {
  try {
    const { reference_number } = req.params;

    const requestId = await rp.getRequestIdByReferenceId(reference_number);
    if (requestId != null) {
      res.status(200).json({ request_id: requestId });
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/requests/data/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    const data = await rp.getDataFromAS(request_id);
    if (data != null) {
      res.status(200).json(data);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/requests/housekeeping/data/:request_id',
  async (req, res, next) => {
    try {
      const { request_id } = req.params;

      await rp.removeDataFromAS(request_id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/requests/housekeeping/data', async (req, res, next) => {
  try {
    await rp.removeAllDataFromAS();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/requests/close', validateBody, async (req, res, next) => {
  try {
    const { request_id } = req.body;

    await common.closeRequest(request_id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/callback', async (req, res, next) => {
  try {
    const urls = rp.getCallbackUrls();

    if (Object.keys(urls).length > 0) {
      res.status(200).json(urls);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/callback', validateBody, async (req, res, next) => {
  try {
    const { error_url } = req.body;

    rp.setCallbackUrls({
      error_url,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
