import express from 'express';

import { validateBody } from './middleware/validation';
import * as as from '../core/as';

const router = express.Router();

router.post('/service/:service_id', validateBody, async (req, res, next) => {
  try {
    const { service_id } = req.params;
    const { min_ial, min_aal, url } = req.body;

    await as.registerAsService({
      service_id,
      min_aal,
      min_ial,
      url,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    const result = await as.getServiceDetail(service_id);

    if (result == null) {
      res.status(404).end();
    } else {
      res.status(200).json(result);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
