import express from 'express';

import { validateQuery, validateBody } from './middleware/validation';
import * as identity from '../core/identity';
import * as common from '../core/common';

const router = express.Router();

router.post('/', validateBody, async (req, res, next) => {
  try {
    const {
      namespace,
      identifier,
      //secret,
      accessor_type,
      accessor_public_key,
      accessor_id,
      accessor_group_id,
      ial,
    } = req.body;

    await identity.createNewIdentity({
      namespace,
      identifier,
      //secret,
      accessor_type,
      accessor_public_key,
      accessor_id,
      accessor_group_id,
      ial,
    });

    res.status(201).end();
  } catch (error) {
    next(error);
  }
});

router.get('/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    const idpNodes = await common.getIdpNodes({
      namespace,
      identifier,
      min_ial: 0,
      min_aal: 0,
    });

    if (idpNodes.length !== 0) {
      res.status(204).end();
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/:namespace/:identifier', validateBody, async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    next(error);
  }
});

router.get('/:namespace/:identifier/endorsement', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    next(error);
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
      next(error);
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
      next(error);
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
      next(error);
    }
  }
);

export default router;
