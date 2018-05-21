import express from 'express';

import { validateQuery, validateBody } from './middleware/validation';
import * as abciAppIdentityApi from '../main/identity';
import * as abciAppCommonApi from '../main/common';

const router = express.Router();

router.post('/', validateBody, async (req, res, next) => {
  try {
    const {
      namespace,
      identifier,
      secret,
      accessor_type,
      accessor_key,
      accessor_id,
    } = req.body;

    let isSuccess = await abciAppIdentityApi.createNewIdentity({
      namespace,
      identifier,
      secret,
      accessor_type,
      accessor_key,
      accessor_id,
    });

    if (isSuccess) {
      res.status(201).json('Identity Created');
    } else {
      res.status(500).end();
    }
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    let checkIdpNodeIds = await abciAppCommonApi.getNodeIdsOfAssociatedIdp({
      namespace,
      identifier,
      min_ial: 1,
    });
    let status =
      checkIdpNodeIds && checkIdpNodeIds.node_id.length !== 0 ? 200 : 404;

    res.status(status).end();
  } catch (error) {
    console.error(error);
    res.status(500).end();
  }
});

router.post('/:namespace/:identifier', validateBody, async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/:namespace/:identifier/endorsement', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post(
  '/:namespace/:identifier/endorsement',
  validateBody,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { secret, accessor_type, accessor_key, accessor_id } = req.body;

      // Not Implemented
      // TODO

      res.status(501).end();
    } catch (error) {
      res.status(500).end();
    }
  }
);

router.post(
  '/:namespace/:identifier/accessors',
  validateBody,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { accessor_type, accessor_key, accessor_id } = req.body;

      // Not Implemented
      // TODO

      res.status(501).end();
    } catch (error) {
      res.status(500).end();
    }
  }
);

router.get(
  '/:namespace/:identifier/requests/history',
  validateQuery,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { count } = req.query;

      // Not Implemented
      // TODO

      res.status(501).end();
    } catch (error) {
      res.status(500).end();
    }
  }
);

export default router;
