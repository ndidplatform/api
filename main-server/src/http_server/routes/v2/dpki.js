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
import { ndidOnlyHandler } from '../middleware/role_handler';
import * as ndid from '../../../core/ndid';
import * as dpki from '../../../core/dpki';
import * as externalCryptoService from '../../../utils/external_crypto_service';

const router = express.Router();

router.post(
  '/node/create',
  ndidOnlyHandler,
  validateBody,
  async (req, res, next) => {
    try {
      const {
        reference_id,
        callback_url,
        node_id,
        node_name,
        node_key,
        node_key_type,
        // node_sign_method,
        node_master_key,
        node_master_key_type,
        // node_master_sign_method,
        role,
        max_aal,
        max_ial,
      } = req.body;

      await ndid.registerNode(
        {
          reference_id,
          callback_url,
          node_id,
          node_name,
          public_key: node_key,
          public_key_type: node_key_type,
          master_public_key: node_master_key,
          master_public_key_type: node_master_key_type,
          role,
          max_ial,
          max_aal,
        },
        { synchronous: false }
      );

      res.status(202).end();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/node/update', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      reference_id,
      callback_url,
      node_key,
      node_key_type,
      // node_sign_method,
      node_master_key,
      node_master_key_type,
      // node_master_sign_method,
      check_string,
      signed_check_string,
      master_signed_check_string,
    } = req.body;

    //should we allow organization to update their node's name?
    let result = await dpki.updateNode(
      {
        node_id,
        reference_id,
        callback_url,
        public_key: node_key,
        public_key_type: node_key_type,
        master_public_key: node_master_key,
        master_public_key_type: node_master_key_type,
        check_string,
        signed_check_string,
        master_signed_check_string,
      },
      { synchronous: false }
    );

    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/node/callback', async (req, res, next) => {
  try {
    const urls = externalCryptoService.getCallbackUrls();

    if (Object.keys(urls).length > 0) {
      res.status(200).json(urls);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/node/callback', validateBody, async (req, res, next) => {
  try {
    const { sign_url, master_sign_url, decrypt_url } = req.body;

    await externalCryptoService.setDpkiCallback({
      signCallbackUrl: sign_url,
      masterSignCallbackUrl: master_sign_url,
      decryptCallbackUrl: decrypt_url,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
