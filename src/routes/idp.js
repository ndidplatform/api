import express from 'express';

import { validateBody } from './middleware/validation';
import * as idp from '../core/idp';

const router = express.Router();

router.get('/callback', async (req, res, next) => {
  try {
    const urls = idp.getCallbackUrls();

    if (Object.keys(urls).length > 0) {
      res.status(200).json(urls);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/callback', validateBody, async (req, res, next) => {
  try {
    const {
      incoming_request_url,
      identity_result_url,
      accessor_sign_url,
      error_url,
    } = req.body;

    idp.setCallbackUrls({
      incoming_request_url,
      identity_result_url,
      accessor_sign_url,
      error_url,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/response', validateBody, async (req, res, next) => {
  try {
    const {
      request_id,
      //namespace,
      //identifier,
      ial,
      aal,
      secret,
      status,
      signature,
      accessor_id,
      //request_message,
    } = req.body;

    await idp.requestChallengeAndCreateResponse({
      request_id,
      //namespace,
      //identifier,
      ial,
      aal,
      secret,
      status,
      signature,
      accessor_id,
      //request_message,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
