import express from 'express';

import { validateBody } from './middleware/validation';
import * as as from '../core/as';

const router = express.Router();

router.post('/service/:service_id', validateBody, async (req, res, next) => {
  try {
    const { service_id } = req.params;
    const { service_name, min_ial, min_aal, url } = req.body;

    await as.registerAsService({
      service_id,
      service_name,
      min_aal,
      min_ial,
      url,
    });

    res.status(201).json('Created');
  } catch (error) {
    next(error);
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    let result = await as.getServiceDetail(service_id);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
