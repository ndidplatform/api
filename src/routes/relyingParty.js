import express from 'express';

import * as abciAppRpApi from '../main/rp';
import * as abciAppCommonApi from '../main/common';

import validate from './validator';

const router = express.Router();

router.post('/requests/:namespace/:identifier', async (req, res, next) => {
  try {
    // Path params validation (no rules = not needed according to specs)
    // const paramsValidationResult = validate({
    //   method: req.method,
    //   path: `${req.baseUrl}${req.route.path}`,
    //   params: req.params,
    // });
    // if (!paramsValidationResult.valid) {
    //   res.status(400).send(paramsValidationResult);
    //   return;
    // }

    const bodyValidationResult = validate({
      method: req.method,
      path: `${req.baseUrl}${req.route.path}`,
      body: req.body,
    });
    if (!bodyValidationResult.valid) {
      res.status(400).send(bodyValidationResult);
      return;
    }

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

    if(!requestId) throw 'Cannot create request';
    res.status(200).send({ requestId });
  } catch (error) {
    console.error(error);
    res.status(500).end();
  }
});

router.get('/requests/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    const request = await abciAppCommonApi.getRequest({
      requestId: request_id,
    });

    res.status(200).send(request);
  } catch (error) {
    console.error(error);
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
    res.status(200).send(abciAppRpApi.getDataFromAS(req.params.request_id));
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
