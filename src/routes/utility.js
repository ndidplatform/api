import express from 'express';

import { validateQuery } from './middleware/validation';
import * as tendermintNdid from '../tendermint/ndid';

const router = express.Router();

router.get('/idp', validateQuery, async (req, res, next) => {
  try {
    const { min_ial = 0, min_aal = 0 } = req.query;

    const idpNodes = await tendermintNdid.getIdpNodes({
      min_ial: parseFloat(min_ial),
      min_aal: parseFloat(min_aal),
    });

    res.status(200).json(idpNodes);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/idp/:namespace/:identifier',
  validateQuery,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { min_ial = 0, min_aal = 0 } = req.query;

      const idpNodes = await tendermintNdid.getIdpNodes({
        namespace,
        identifier,
        min_ial: parseFloat(min_ial),
        min_aal: parseFloat(min_aal),
      });

      res.status(200).json(idpNodes);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/as/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;
    let asNodes = await tendermintNdid.getAsNodesByServiceId({
      service_id,
    });
    res.status(200).json(asNodes);
  } catch (error) {
    next(error);
  }
});

router.get('/requests/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    const request = await tendermintNdid.getRequestDetail({
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

router.get('/node_token/:node_id', async (req, res, next) => {
  try {
    const { node_id } = req.params;

    const result = await tendermintNdid.getNodeToken(node_id);

    if (result == null) {
      res.status(404).end();
    } else {
      res.status(200).json(result);
    }
  } catch (error) {
    next(error);
  }
});

router.get('/namespaces', async (req, res, next) => {
  try {
    res.status(200).json(await tendermintNdid.getNamespaceList());
  } catch (error) {
    next(error);
  }
});

router.get('/services', async (req, res, next) => {
  try {
    res.status(200).json(await tendermintNdid.getServiceList());
  } catch (error) {
    next(error);
  }
});

export default router;
