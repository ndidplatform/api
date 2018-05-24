import express from 'express';

import { validateBody } from './middleware/validation';
import * as abciAppNdid from '../main/ndid';

const router = express.Router();

router.post('/initNDID', async (req, res, next) => {
  try {
    await abciAppNdid.initNDID(req.body.public_key);
    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/registerNode', async (req, res, next) => {
  try {
    const { node_id, public_key, role } = req.body;

    await abciAppNdid.registerNode({
      node_id,
      public_key,
      role,
    });

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/setNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await abciAppNdid.setNodeToken({
      node_id,
      amount,
    });

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/addNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await abciAppNdid.addNodeToken({
      node_id,
      amount,
    });

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/reduceNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await abciAppNdid.reduceNodeToken({
      node_id,
      amount,
    });

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/addNamespace', async (req, res, next) => {
  try {
    const { namespace, description } = req.body;

    let result = abciAppNdid.addNamespace({
      namespace,
      description,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/deleteNamespace', async (req, res, next) => {
  try {
    const { namespace } = req.body;

    let result = abciAppNdid.deleteNamespace({
      namespace,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
