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
import * as node from '../../../core/node';
import * as nodeCallback from '../../../core/node_callback';
import * as externalCryptoService from '../../../external_crypto_service';
import * as cryptoUtils from '../../../utils/crypto';

const router = express.Router();

router.post(
  '/create',
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
          signing_public_key: node_key,
          signing_key_algorithm: node_key_type,
          signing_algorithm:
            cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_256.name,
          signing_master_public_key: node_master_key,
          signing_master_key_algorithm: node_master_key_type,
          signing_master_algorithm:
            cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_256.name,
          encryption_public_key: node_key,
          encryption_key_algorithm: node_key_type,
          encryption_algorithm:
            cryptoUtils.encryptionAlgorithm.RSAES_PKCS1_V1_5.name,
          role,
          max_ial,
          max_aal,
        },
        { synchronous: false }
      );

      res.status(202).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/update', validateBody, async (req, res, next) => {
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
      supported_request_message_data_url_type_list,
    } = req.body;

    //should we allow organization to update their node's name?
    const result = await node.updateNode(
      {
        node_id,
        reference_id,
        callback_url,
        signing_public_key: node_key,
        signing_key_algorithm: node_key_type,
        signing_algorithm:
          cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_256.name,
        signing_master_public_key: node_master_key,
        signing_master_key_algorithm: node_master_key_type,
        signing_master_algorithm:
          cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_256.name,
        encryption_public_key: node_key,
        encryption_key_algorithm: node_key_type,
        encryption_algorithm:
          cryptoUtils.encryptionAlgorithm.RSAES_PKCS1_V1_5.name,
        check_string,
        signed_check_string,
        master_signed_check_string,
        supported_request_message_data_url_type_list,
      },
      { synchronous: false }
    );

    res.status(202).json(result);
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/callback', async (req, res, next) => {
  try {
    const [externalCryptoServiceCallbackUrls, nodeCallbackUrls] =
      await Promise.all([
        externalCryptoService.getCallbackUrls(),
        nodeCallback.getCallbackUrls(),
      ]);

    const urls = {
      ...externalCryptoServiceCallbackUrls,
      ...nodeCallbackUrls,
    };

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
    const {
      sign_url,
      master_sign_url,
      decrypt_url,
      message_queue_send_success_url,
    } = req.body;

    await Promise.all([
      externalCryptoService.setCallbackUrls({
        signCallbackUrl: sign_url,
        masterSignCallbackUrl: master_sign_url,
        decryptCallbackUrl: decrypt_url,
      }),
      nodeCallback.setCallbackUrls({
        message_queue_send_success_url,
      }),
    ]);
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
