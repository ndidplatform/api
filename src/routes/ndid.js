import express from 'express';

import { validateBody } from './middleware/validation';
import * as ndid from '../core/ndid';

const router = express.Router();

router.post('/initNDID', async (req, res, next) => {
  try {
    await ndid.initNDID(req.body.public_key);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/registerNode', async (req, res, next) => {
  try {
    const {
      node_id,
      public_key,
      master_public_key,
      role,
      max_aal,
      max_ial,
    } = req.body;

    await ndid.registerNode({
      node_id,
      public_key,
      master_public_key,
      role,
      max_aal,
      max_ial,
    });

    res.status(201).end();
  } catch (error) {
    next(error);
  }
});

router.post('/setNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.setNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/addNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.addNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/reduceNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.reduceNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/namespaces', async (req, res, next) => {
  try {
    const { namespace, description } = req.body;

    await ndid.addNamespace({
      namespace,
      description,
    });
    res.status(201).end();
  } catch (error) {
    next(error);
  }
});

router.delete('/namespaces/:namespace', async (req, res, next) => {
  try {
    const { namespace } = req.params;

    await ndid.deleteNamespace({
      namespace,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
