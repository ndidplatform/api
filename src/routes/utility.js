import express from 'express';

import { validateQuery } from './middleware/validation';
import * as common from '../core/common';

const router = express.Router();

router.get('/idp', validateQuery, async (req, res, next) => {
  try {
    const { min_ial = 1, min_aal = 1 } = req.query;

    const idpNodeIds = await common.getNodeIdsOfAssociatedIdp({
      min_ial,
      min_aal,
    });

    res.status(200).json(idpNodeIds);
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

      const idpNodeIds = await common.getNodeIdsOfAssociatedIdp({
        namespace,
        identifier,
        min_ial,
        min_aal,
      });

      res.status(200).json(
        idpNodeIds
          ? idpNodeIds
          : {
              node: [],
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
    let asNodeIds = await common.getNodeIdsOfAsWithService({
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

    res.status(200).json(await common.getNodeToken(node_id));
  } catch (error) {
    next(error);
  }
});

router.get('/namespace', async (req, res, next) => {
  try {
    res.status(200).json(await common.getNamespaceList());
  } catch (error) {
    next(error);
  }
});

export default router;
