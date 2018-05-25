import express from 'express';

import { validateQuery } from './middleware/validation';
import * as abciAppCommonApi from '../main/common';

const router = express.Router();

router.get('/idp', validateQuery, async (req, res, next) => {
  try {
    const { min_ial = 1, min_aal = 1 } = req.query;

    const idpNodeIds = await abciAppCommonApi.getNodeIdsOfAssociatedIdp({
      min_ial,
      min_aal,
    });

    res.status(200).send(idpNodeIds);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/idp/:namespace/:identifier',
  validateQuery,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { min_ial = 1, min_aal = 1 } = req.query;

      const idpNodeIds = await abciAppCommonApi.getNodeIdsOfAssociatedIdp({
        namespace,
        identifier,
        min_ial,
        min_aal,
      });

      res.status(200).json(
        idpNodeIds
          ? idpNodeIds
          : {
              node_id: [],
            }
      );
    } catch (error) {
      next(error);
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
    next(error);
  }
});

router.get('/nodeToken/:node_id', async (req, res, next) => {
  try {
    const { node_id } = req.params;

    res.status(200).json(await abciAppCommonApi.getNodeToken(node_id));
  } catch (error) {
    next(error);
  }
});

router.get('/namespace', async (req, res, next) => {
  try {
    res.status(200).json(await abciAppCommonApi.getNamespaceList());
  } catch (error) {
    next(error);
  }
});

export default router;
