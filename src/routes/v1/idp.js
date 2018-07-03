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
import * as idp from '../../core/idp';

const router = express.Router();

router.get('/callback', async (req, res, next) => {
  try {
    const urls = idp.getCallbackUrls();

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
    const {
      incoming_request_url,
      identity_result_url,
      accessor_sign_url,
      error_url,
    } = req.body;

    idp.setCallbackUrls({
      incoming_request_url,
      identity_result_url,
      accessor_sign_url,
      error_url,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/response', validateBody, async (req, res, next) => {
  try {
    const {
      reference_id,
      request_id,
      //namespace,
      //identifier,
      ial,
      aal,
      secret,
      status,
      signature,
      accessor_id,
      callback_url,
      //request_message,
    } = req.body;

    await idp.requestChallengeAndCreateResponse({
      reference_id,
      request_id,
      //namespace,
      //identifier,
      ial,
      aal,
      secret,
      status,
      signature,
      accessor_id,
      callback_url,
      //request_message,
    });

    res.status(202).end();
  } catch (error) {
    next(error);
  }
});

export default router;
