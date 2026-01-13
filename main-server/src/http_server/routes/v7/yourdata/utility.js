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
import * as coreYourData from '../../../../core/yourdata';

const router = express.Router();

router.post('/token', async (req, res, next) => {
  try {
    const payload = req.body;
    const { as_node_id } = payload;

    const { token } = await coreYourData.createToken({
      nodeId: as_node_id,
      payload,
    });

    res.status(200).json(token);

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/as_error_codes', async (req, res, next) => {
  try {
    res.status(200).json(await tendermintNdid.getYourDataErrorCodeList('as'));

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/rp_node_whitelist', async (req, res, next) => {
  try {
    const result = await tendermintNdid.getYourDataRPNodeWhitelist();

    res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/as_node_whitelist', async (req, res, next) => {
  try {
    const result = await tendermintNdid.getYourDataASNodeWhitelist();

    res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

export default router;
