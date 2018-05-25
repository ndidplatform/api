import express from 'express';

import { validateBody } from './middleware/validation';
import * as abciAppCommonApi from '../main/common';
import * as abciAppNdidApi from '../main/ndid';
import * as abciAppDpkiApi from '../main/dpki';
import * as utils from '../utils';
import * as config from '../config';

const router = express.Router();

router.post('/node/create', validateBody, async (req, res, next) => {
  if(config.role !== 'ndid') {
    res.status(403).end();
    return;
  }
  try {
    const {
      node_id,
      node_name,
      node_key,
      //node_key_type,
      //node_key_method,
      node_master_key,
      //node_master_key_type,
      //node_master_key_method,
      role
    } = req.body;

    let result = await abciAppNdidApi.registerNode({
      node_id,
      node_name,
      public_key: node_key,
      master_public_key: node_master_key,
      role,
      max_ial: 3,
      max_aal: 3,
    });

    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
});

router.post('/node/update', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      //node_name,
      node_key,
      //node_key_type,
      //node_key_method,
      node_master_key,
      //node_master_key_type,
      //node_master_key_method,
    } = req.body;

    //should we allow organization to update their node's name?
    let result = await abciAppDpkiApi.updateNode({
      node_id,
      public_key: node_key,
      master_public_key: node_master_key
    });

    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
});

router.post('/node/register_callback', validateBody, async (req, res, next) => {
  try {
    const { signatureUrl, decryptUrl } = req.body;

    await utils.setSignatureCallback(signatureUrl, decryptUrl);
    res.status(200).end();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/node/register_callback_master',
  validateBody,
  async (req, res, next) => {
    try {
      const { url } = req.body;

      await utils.setMasterSignatureCallback(url);
      res.status(200).end();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
