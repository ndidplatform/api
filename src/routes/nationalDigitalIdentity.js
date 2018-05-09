import express from 'express';
import * as abciAppNdid from '../main/ndid';

import validate from './validator';

const router = express.Router();

router.post('/initNDID', async (req, res, next) => {
  try {
    let result = await abciAppNdid.initNDID(req.body.public_key);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/registerNode', async (req, res, next) => {
  try {
    const {
      node_id,
      public_key,
      role
    } = req.body;

    let result = await abciAppNdid.registerNode({
      node_id,
      public_key,
      role
    });

    res.status(200).send(result);
  } catch (error) {
    res.status(500).end();
  }
});

export default router;