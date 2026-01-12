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

import { validateQuery } from '../../middleware/validation';
import * as tendermintNdid from '../../../../tendermint/ndid';

const router = express.Router();

router.post('/request', async (req, res, next) => {
  try {
    const {
      node_id,
      service_id,
      service_version,
      service_extension,
      rp_node_id,
      as_node_id,
      reference_id,
      callback_url,
      namespace,
      identifier,
      request_params,
      authorization,
      request_timeout,
    } = req.body;

    // TODO

    // res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/request_data/:request_id', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { request_id } = req.params;

    // TODO

    // res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.post('/request_data_removal', async (req, res, next) => {
  try {
    const { node_id, rp_node_id, request_id } = req.body;

    // TODO

    // res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

export default router;
