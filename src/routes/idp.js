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

    await idp.createIdpResponse({
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

router.get('/accessor/callback', async (req, res, next) => {
  try {
    const url = idp.getAccessorCallback();

    if (url != null) {
      res.status(200).json({ url });
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/accessor/callback', validateBody, async (req, res, next) => {
  try {
    const { url } = req.body;

    idp.setAccessorCallback(url);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
