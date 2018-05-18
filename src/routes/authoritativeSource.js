import express from 'express';

import * as abciAppAsApi from '../main/as';
import validate from './validator';

const router = express.Router();

/*router.get('/callback', async (req, res, next) => {
  try {
    const url = abciAppAsApi.getCallbackUrl();

    res.status(200).json({ url });
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/callback', async (req, res, next) => {
  try {
    const validationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!validationResult.valid) {
      res.status(400).json(validationResult);
      return;
    }

    const { url } = req.body;

    abciAppAsApi.setCallbackUrl(url);

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});*/

router.post('/service/:service_id', async (req, res, next) => {
  try {
    const validationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!validationResult.valid) {
      res.status(400).json(validationResult);
      return;
    }
    
    const { service_id, service_name, min_ial, min_aal, url } = req.body;

    await abciAppAsApi.registerAsService({
      service_id,
      service_name,
      min_aal,
      min_ial,
      url
    });

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    let result = await abciAppAsApi.getServiceDetail(req.params.service_id);

    res.status(200).end(result);
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
