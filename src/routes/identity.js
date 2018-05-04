import express from 'express';
import * as abciAppIdentityApi from '../main/identity';

import validate from './validator';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

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

    res.status(200).send(isSuccess);
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/:namespace/:identifier', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

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

router.post('/:namespace/:identifier/endorsement', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

    const { namespace, identifier } = req.params;
    const { secret, accessor_type, accessor_key, accessor_id } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/:namespace/:identifier/accessors', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

    const { namespace, identifier } = req.params;
    const { accessor_type, accessor_key, accessor_id } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get(
  '/:namespace/:identifier/requests/history',
  async (req, res, next) => {
    try {
      const queryValidationResult = validate({
        method: req.method,
        path: `${req.baseUrl}${req.route.path}`,
        query: req.query,
      });
      if (!queryValidationResult.valid) {
        res.status(400).send(queryValidationResult);
        return;
      }

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
