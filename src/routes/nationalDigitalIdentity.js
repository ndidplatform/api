import express from 'express';

import { validateBody } from './middleware/validation';
import * as abciAppNdid from '../main/ndid';

const router = express.Router();

router.post('/initNDID', async (req, res, next) => {
  try {
    await abciAppNdid.initNDID(req.body.public_key);
    res.status(200).end();
  } catch (error) {
    next(error);
  }
});

router.post('/registerNode', async (req, res, next) => {
  try {
    const { node_id, public_key, master_public_key, role, max_aal, max_ial } = req.body;

    await abciAppNdid.registerNode({
      node_id,
      public_key,
      master_public_key,
      role,
      max_aal,
      max_ial
    });

    res.status(200).end();
  } catch (error) {
    next(error);
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
    next(error);
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
    next(error);
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
    next(error);
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
    next(error);
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
    next(error);
  }
});

export default router;
