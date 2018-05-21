import express from 'express';

import { validateBody } from './middleware/validation';
import * as abciAppCommonApi from '../main/common';
import * as utils from '../utils';

const router = express.Router();

router.post('/node/create', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      node_name,
      node_key,
      node_key_type,
      node_key_method,
      node_master_key,
      node_master_key_type,
      node_master_key_method,
    } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/node/update', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      node_name,
      node_key,
      node_key_type,
      node_key_method,
      node_master_key,
      node_master_key_type,
      node_master_key_method,
    } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/node/register_callback', validateBody, async (req, res, next) => {
  try {
    const { url } = req.body;

    await utils.setSignatureCallback(url);
    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post(
  '/node/register_callback_master',
  validateBody,
  async (req, res, next) => {
    try {
      const { url } = req.body;

      // Not Implemented
      // TODO

      res.status(501).end();
    } catch (error) {
      res.status(500).end();
    }
  }
);

export default router;
