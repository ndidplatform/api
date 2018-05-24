import express from 'express';

import { validateBody } from './middleware/validation';
import * as abciAppRpApi from '../main/rp';
import * as abciAppCommonApi from '../main/common';
import * as db from '../db';

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

      const requestId = await abciAppRpApi.createRequest({
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

    const request = await abciAppCommonApi.getRequest({
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

    const requestId = await abciAppRpApi.getRequestIdByReferenceId(
      reference_number
    );
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

    const data = await abciAppRpApi.getDataFromAS(request_id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

router.delete('/requests/data/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    await abciAppRpApi.removeDataFromAS(request_id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.delete('/requests/data', async (req, res, next) => {
  try {
    await abciAppRpApi.removeAllDataFromAS();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
