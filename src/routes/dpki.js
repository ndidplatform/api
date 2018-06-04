import express from 'express';

import { validateBody } from './middleware/validation';
import * as ndid from '../core/ndid';
import * as dpki from '../core/dpki';
import * as utils from '../utils';

const router = express.Router();

router.post('/node/create', validateBody, async (req, res, next) => {
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
      max_aal,
      max_ial,
    } = req.body;

    await ndid.registerNode({
      node_id,
      node_name,
      public_key: node_key,
      master_public_key: node_master_key,
      role,
      max_ial,
      max_aal,
    });

    res.status(201).end();
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
    const { sign_url, decrypt_url } = req.body;

    await utils.setSignatureCallback(sign_url, decrypt_url);
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
