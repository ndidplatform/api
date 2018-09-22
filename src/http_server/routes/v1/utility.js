/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 *
 * This file is part of NDID software.
 *
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 *
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 *
 * Please contact info@ndid.co.th for any further questions
 *
 */

import express from 'express';

import { validateQuery } from '../middleware/validation';
import * as tendermintNdid from '../../../tendermint/ndid';

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
    const asNodes = await tendermintNdid.getAsNodesByServiceId({
      service_id,
    });
    if (asNodes.length === 0) {
      const services = await tendermintNdid.getServiceList();
      const service = services.find(
        (service) => service.service_id === service_id
      );
      if (service == null) {
        res.status(404).end();
        return;
      }
    }
    res.status(200).json(asNodes);
  } catch (error) {
    next(error);
  }
});

router.get('/requests/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    const requestWithSpecialTag = await tendermintNdid.getRequestDetail({
      requestId: request_id,
    });

    if (requestWithSpecialTag != null) {
      const { special, ...request } = requestWithSpecialTag;
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

    const amount = await tendermintNdid.getNodeToken(node_id);

    if (amount == null) {
      res.status(404).end();
    } else {
      res.status(200).json({ amount });
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
