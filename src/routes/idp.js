import express from 'express';

import { validateBody } from './middleware/validation';
import * as idp from '../core/idp';

const router = express.Router();

router.get('/callback', async (req, res, next) => {
  try {
    const url = idp.getCallbackUrl();

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

    idp.setCallbackUrl(url);

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

    await idp.createIdpResponse({
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
