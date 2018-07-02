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
import * as as from '../../core/as';

const router = express.Router();

router.post('/service/:service_id', validateBody, async (req, res, next) => {
  try {
    const { service_id } = req.params;
    const { reference_id, callback_url, min_ial, min_aal, url } = req.body;

    await as.upsertAsService({
      service_id,
      min_aal,
      min_ial,
      url,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    const result = await as.getServiceDetail(service_id);

    if (result == null) {
      res.status(404).end();
    } else {
      res.status(200).json(result);
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/data/:request_id/:service_id',
  validateBody,
  async (req, res, next) => {
    try {
      const { request_id, service_id } = req.params;
      const { reference_id, callback_url, data } = req.body;

      as.processDataForRP(data, {
        requestId: request_id,
        serviceId: service_id,
      });

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/callback', async (req, res, next) => {
  try {
    const urls = as.getCallbackUrls();

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

    as.setCallbackUrls({
      error_url,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
