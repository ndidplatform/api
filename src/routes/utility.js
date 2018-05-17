import express from 'express';

import * as abciAppCommonApi from '../main/common';
import validate from './validator';

const router = express.Router();

router.get('/idp', async (req, res, next) => {
  try {
    const queryValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      query: req.query,
    });
    if (!queryValidationResult.valid) {
      res.status(400).json(queryValidationResult);
      return;
    }

    const { min_ial, min_aal } = req.query;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/idp/:namespace/:identifier', async (req, res, next) => {
  try {
    const queryValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      query: req.query,
    });
    if (!queryValidationResult.valid) {
      res.status(400).json(queryValidationResult);
      return;
    }

    const { namespace, identifier } = req.params;
    const { min_ial, /*min_aal*/ } = req.query;

    let idpNodeIds = await abciAppCommonApi.getNodeIdsOfAssociatedIdp({
      namespace,
      identifier,
      min_ial,
    });

    res.status(200).send(idpNodeIds ? idpNodeIds : {
      node_id: []
    });
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/nodeToken/:nodeId', async (req, res, next) => {
  try {
    res
      .status(200)
      .json(await abciAppCommonApi.getNodeToken(req.params.nodeId));
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
