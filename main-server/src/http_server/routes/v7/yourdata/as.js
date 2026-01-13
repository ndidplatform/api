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

import { validateQuery, validateBody } from '../../middleware/validation';
import * as tendermintNdid from '../../../../tendermint/ndid';
import * as coreYourDataAS from '../../../../core/yourdata/as';

const router = express.Router();

router.post('/callback', validateBody, async (req, res, next) => {
  try {
    const { incoming_request_status_update_url, error_url } = req.body;

    await coreYourDataAS.setCallbackUrls({
      incoming_request_status_update_url,
      error_url,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/callback', async (req, res, next) => {
  try {
    const urls = await coreYourDataAS.getCallbackUrls();

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

router.post('/service/:service_id', async (req, res, next) => {
  try {
    const {
      node_id,
      service_url,
      supported_namespace_list,
      supported_authorization,
      service_availability,
    } = req.body;

    // TODO

    // res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { as_node_id } = req.query;

    // TODO

    // res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.post('/data', async (req, res, next) => {
  try {
    const { as_node_id, request_id, data } = req.body;

    // TODO

    // res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.post('/error', async (req, res, next) => {
  try {
    const { as_node_id, request_id, error_code, error_message } = req.body;

    // TODO

    // res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

export default router;
