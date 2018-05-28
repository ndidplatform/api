import express from 'express';

import { validateBody } from './middleware/validation';
import * as ndid from '../core/ndid';
import * as dpki from '../core/dpki';
import * as utils from '../utils';
import * as config from '../config';

const router = express.Router();

router.post('/node/create', validateBody, async (req, res, next) => {
  if (config.role !== 'ndid') {
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
      role,
    } = req.body;

    const result = await ndid.registerNode({
      node_id,
      node_name,
      public_key: node_key,
      master_public_key: node_master_key,
      role,
      max_ial: 3,
      max_aal: 3,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/node/update', validateBody, async (req, res, next) => {
  try {
    const {
      //node_name,
      node_key,
      //node_key_type,
      //node_key_method,
      node_master_key,
      //node_master_key_type,
      //node_master_key_method,
    } = req.body;

    //should we allow organization to update their node's name?
    let result = await dpki.updateNode({
      public_key: node_key,
      master_public_key: node_master_key,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/node/register_callback', validateBody, async (req, res, next) => {
  try {
    const { signUrl, decryptUrl } = req.body;

    await utils.setSignatureCallback(signUrl, decryptUrl);
    res.status(204).end();
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
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
