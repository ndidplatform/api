import express from 'express';

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
      res.status(400).send(queryValidationResult);
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
      res.status(400).send(queryValidationResult);
      return;
    }

    const { namespace, identifier } = req.params;
    const { min_ial, min_aal } = req.query;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
