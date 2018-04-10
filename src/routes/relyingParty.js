import express from 'express';
import * as rp from './rp';
import * as share from './share';

const router = express.Router();

router.post('/requests/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;
    const {
      reference_number,
      // idp_list,
      callback_url,
      // as_service_list,
      request_message,
      // min_ial,
      // min_aal,
      min_idp,
      request_timeout,
    } = req.body;

    let requestId = await rp.createRequest({
      message: request_message,
      minIdp: min_idp
    });

    let idpList = await rp.getMsqDestination({
      namespace, identifier
    });
    // TO-DO
    //send message to IDPs via message queue

    res.status(200).send(requestId);
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/requests/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    // TO-DO
    let request = await share.getRequest({
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
    // TO-DO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/requests/data/:request_id', async (req, res, next) => {
  try {
    // Not Implemented
    // TO-DO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
