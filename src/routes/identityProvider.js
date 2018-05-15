import express from 'express';
import * as abciAppIdpApi from '../main/idp';
import * as abciAppCommonApi from '../main/common';

import validate from './validator';

const router = express.Router();

router.get('/callback', async (req, res, next) => {
  try {
    const url = abciAppIdpApi.getCallbackUrl();

    res.status(200).json({ url });
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/callback', async (req, res, next) => {
  try {
    const { url } = req.body;

    const validationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!validationResult.valid) {
      res.status(400).json(validationResult);
      return;
    }

    abciAppIdpApi.setCallbackUrl(url);

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/response', async (req, res, next) => {
  try {
    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).json(bodyValidationResult);
      return;
    }

    const {
      request_id,
      namespace,
      identifier,
      ial,
      aal,
      secret,
      status,
      signature,
      accessor_id,
    } = req.body;

    let isSuccess = await abciAppIdpApi.createIdpResponse({
      request_id,
      namespace,
      identifier,
      ial,
      aal,
      secret,
      status,
      signature,
      accessor_id,
    });

    if (isSuccess) {
      res.status(200).json('Response Successful');
    } else {
      res.status(500).end();
    }
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
