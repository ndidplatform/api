import express from 'express';

import { validateBody } from './middleware/validation';
import * as rp from '../core/rp';
import * as common from '../core/common';

const router = express.Router();

router.post(
  '/requests/:namespace/:identifier',
  validateBody,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const {
        reference_id,
        idp_list,
        callback_url,
        data_request_list,
        request_message,
        min_ial,
        min_aal,
        min_idp,
        request_timeout,
      } = req.body;

      const requestId = await rp.createRequest({
        namespace,
        identifier,
        reference_id,
        idp_list,
        callback_url,
        data_request_list,
        request_message,
        min_ial,
        min_aal,
        min_idp,
        request_timeout,
      });

      res.status(200).json({ requestId });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/requests/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    const request = await common.getRequest({
      requestId: request_id,
    });

    if (request != null) {
      res.status(200).json(request);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/requests/reference/:reference_number', async (req, res, next) => {
  try {
    const { reference_number } = req.params;

    const requestId = await rp.getRequestIdByReferenceId(reference_number);
    if (requestId != null) {
      res.status(200).json(requestId);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/requests/data/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    const data = await rp.getDataFromAS(request_id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

router.delete('/requests/data/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    await rp.removeDataFromAS(request_id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.delete('/requests/data', async (req, res, next) => {
  try {
    await rp.removeAllDataFromAS();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
