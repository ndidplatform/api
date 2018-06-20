import express from 'express';

import { validateBody } from './middleware/validation';
import * as identity from '../core/identity';
import * as tendermintNdid from '../tendermint/ndid';

const router = express.Router();

router.post('/', validateBody, async (req, res, next) => {
  try {
    const {
      namespace,
      identifier,
      reference_id,
      accessor_type,
      accessor_public_key,
      accessor_id,
      ial,
    } = req.body;

    const result = await identity.createNewIdentity({
      namespace,
      identifier,
      reference_id,
      accessor_type,
      accessor_public_key,
      accessor_id,
      ial,
    });

    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:namespace/:identifier/accessors',
  validateBody,
  async (req, res, next) => {
    try {
      const {
        reference_id,
        accessor_type,
        accessor_public_key,
        accessor_id,
      } = req.body;

      const { namespace, identifier } = req.params;

      const result = await identity.addAccessorMethodForAssociatedIdp({
        namespace,
        identifier,
        reference_id,
        accessor_type,
        accessor_public_key,
        accessor_id,
      });

      if (result.request_id == null) {
        res.status(404).end();
      } else {
        res.status(200).json(result);
      }
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    const idpNodes = await tendermintNdid.getIdpNodes({
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

export default router;
