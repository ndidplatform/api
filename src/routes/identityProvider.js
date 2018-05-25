import express from 'express';

import { validateBody } from './middleware/validation';
import * as abciAppIdpApi from '../main/idp';
import * as abciAppCommonApi from '../main/common';

const router = express.Router();

router.get('/callback', async (req, res, next) => {
  try {
    const url = abciAppIdpApi.getCallbackUrl();

    if (url != null) {
      res.status(200).json({ url });
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/callback', validateBody, async (req, res, next) => {
  try {
    const { url } = req.body;

    abciAppIdpApi.setCallbackUrl(url);

    res.status(200).end();
  } catch (error) {
    next(error);
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

    await abciAppIdpApi.createIdpResponse({
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

    res.status(200).end();
  } catch (error) {
    next(error);
  }
});

export default router;
