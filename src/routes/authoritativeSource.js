import express from 'express';

import { validateBody } from './middleware/validation';
import * as abciAppAsApi from '../main/as';

const router = express.Router();

router.post('/service/:service_id', validateBody, async (req, res, next) => {
  try {
    const { service_name, min_ial, min_aal, url } = req.body;
    const service_id = req.params.service_id;

    await abciAppAsApi.registerAsService({
      service_id,
      service_name,
      min_aal,
      min_ial,
      url,
    });

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    let result = await abciAppAsApi.getServiceDetail(service_id);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
