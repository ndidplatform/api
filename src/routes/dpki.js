import express from 'express';
import * as abciAppCommonApi from '../main/common';

import validate from './validator';

const router = express.Router();

router.post('/node/create', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

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

router.post('/node/update', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

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

router.post('/node/register_callback', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

    const { url } = req.body;

    await abciAppCommonApi.setSignatureCallback(url);
    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/node/register_callback_master', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

    const { url } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
