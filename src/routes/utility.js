import express from 'express';

import { validateQuery } from './middleware/validation';
import * as abciAppCommonApi from '../main/common';

const router = express.Router();

router.get('/idp', validateQuery, async (req, res, next) => {
  try {
    const { min_ial, min_aal } = req.query;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get(
  '/idp/:namespace/:identifier',
  validateQuery,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { min_ial /*min_aal*/ } = req.query;

      let idpNodeIds = await abciAppCommonApi.getNodeIdsOfAssociatedIdp({
        namespace,
        identifier,
        min_ial,
      });

      res.status(200).json(
        idpNodeIds
          ? idpNodeIds
          : {
              node_id: [],
            }
      );
    } catch (error) {
      res.status(500).end();
    }
  }
);

router.get('/as/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;
    let asNodeIds = await abciAppCommonApi.getNodeIdsOfAsWithService({
      service_id,
    });
    res.status(200).json(
      asNodeIds
        ? asNodeIds
        : {
            node_id: [],
          }
    );
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
