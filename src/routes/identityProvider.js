import express from 'express';
import * as smartContractIdpApi from '../main/idp';
import * as smartContractCommonApi from '../main/common';

const router = express.Router();

router.get('/callback', async (req, res, next) => {
  try {
    const url = smartContractIdpApi.getCallbackUrl();

    res.status(200).send({ url });
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/callback', async (req, res, next) => {
  try {
    const { url } = req.body;

    smartContractIdpApi.setCallbackUrl(url);

    res.status(200).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/response', async (req, res, next) => {
  try {
    const {
      status,
      request_id,
      namespace,
      identifier,
      secret,
      ial,
      aal,
      signature,
      accessor_id,
    } = req.body;

    let isSuccess = await smartContractIdpApi.createIdpResponse(req.body);

    res.status(200).send(isSuccess);
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
