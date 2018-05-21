import express from 'express';

import { validateBody } from './middleware/validation';
import * as abciAppIdpApi from '../main/idp';
import * as abciAppCommonApi from '../main/common';

const router = express.Router();

router.get('/callback', async (req, res, next) => {
  try {
    const url = abciAppIdpApi.getCallbackUrl();

    res.status(200).json({ url });
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/callback', validateBody, async (req, res, next) => {
  try {
    const { url } = req.body;

    abciAppIdpApi.setCallbackUrl(url);

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/response', validateBody, async (req, res, next) => {
  try {
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
