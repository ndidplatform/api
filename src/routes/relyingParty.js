import express from 'express';

import * as nodeLogicRpApi from '../main/rp';
import * as nodeLogicCommonApi from '../main/share';

const router = express.Router();

router.post('/requests/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;
    const {
      reference_id,
      idp_list,
      callback_url,
      as_service_list,
      request_message,
      min_ial,
      min_aal,
      min_idp,
      request_timeout,
    } = req.body;

    const requestId = await nodeLogicRpApi.createRequest({
      namespace,
      identifier,
      reference_id,
      idp_list,
      callback_url,
      as_service_list,
      request_message,
      min_ial,
      min_aal,
      min_idp,
      request_timeout,
    });

    res.status(200).send({ requestId });
  } catch (error) {
    console.error(error)
    res.status(500).end();
  }
});

router.get('/requests/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    // TODO
    const request = await nodeLogicCommonApi.getRequest({
      requestId: request_id
    });

    res.status(200).send(request);
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/requests/reference/:reference_number', async (req, res, next) => {
  try {
    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/requests/data/:request_id', async (req, res, next) => {
  try {
    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
