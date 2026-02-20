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
import * as tendermintNdid from '../../../../tendermint/ndid';
import * as coreYourData from '../../../../core/yourdata';
import domain from '../../../../core/domain';
import * as privateMessage from '../../../../core/common/private_message';

const router = express.Router();

router.post('/token', validateBody, async (req, res, next) => {
  try {
    const payload = req.body;
    const { as_node_id } = payload;

    const result = await coreYourData.createSignedToken({
      nodeId: as_node_id,
      payload,
    });

    res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/as_error_codes', async (req, res, next) => {
  try {
    res.status(200).json(
      await tendermintNdid.getDomainErrorCodeList({
        domain: domain.YOURDATA,
        type: 'as',
      })
    );

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/node_whitelist', async (req, res, next) => {
  try {
    const result = await tendermintNdid.getDomainNodeWhitelistByDomain({
      domain: domain.YOURDATA,
    });

    res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/private_messages/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;
    const { node_id, type } = req.query;
    const messages = await privateMessage.getPrivateMessages({
      nodeId: node_id,
      requestId: request_id,
      type,
      skipRequestIdCheck: true,
    });
    if (messages == null) {
      res.status(404).end();
      next();
      return;
    }
    res.status(200).json(messages);
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
