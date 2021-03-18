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

import { validateBody } from '../middleware/validation';
import { asOnlyHandler } from '../middleware/role_handler';
import * as as from '../../../core/as';

import { apiVersion } from './version';
import { HTTP_HEADER_FIELDS } from './private_http_header';

const router = express.Router();

router.use(asOnlyHandler);

router.post('/service/:service_id', validateBody, async (req, res, next) => {
  try {
    const { service_id } = req.params;
    const {
      node_id,
      reference_id,
      callback_url,
      min_ial,
      min_aal,
      url,
      supported_namespace_list,
    } = req.body;

    await as.registerOrUpdateASService(
      {
        node_id,
        service_id,
        reference_id,
        callback_url,
        min_aal,
        min_ial,
        url,
        supported_namespace_list,
      },
      { synchronous: false }
    );

    res.status(202).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { service_id } = req.params;

    const result = await as.getServiceDetail(node_id, service_id);

    if (result == null) {
      res.status(404).end();
    } else {
      res.status(200).json(result);
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/payment_received_log/:request_id/:service_id',
  validateBody,
  async (req, res, next) => {
    try {
      const { request_id, service_id } = req.params;
      const { node_id } = req.body;
      const {
        [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
        [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
      } = req.headers;

      await as.logPaymentReceived(
        {
          node_id,
          requestId: request_id,
          serviceId: service_id,
        },
        {
          apiVersion,
          ndidMemberAppType,
          ndidMemberAppVersion,
        }
      );

      res.status(204).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/service_price/:service_id',
  validateBody,
  async (req, res, next) => {
    try {
      const { service_id } = req.params;
      const {
        node_id,
        reference_id,
        callback_url,
        price_by_currency_list,
        effective_datetime,
        more_info_url,
        detail,
      } = req.body;

      await as.setServicePrice(
        {
          node_id,
          reference_id,
          callback_url,
          service_id,
          price_by_currency_list,
          effective_datetime,
          more_info_url,
          detail,
        },
        {
          synchronous: false,
        }
      );

      res.status(202).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/data/:request_id/:service_id',
  validateBody,
  async (req, res, next) => {
    try {
      const { request_id, service_id } = req.params;
      const { node_id, reference_id, callback_url, data } = req.body;
      const {
        [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
        [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
      } = req.headers;

      await as.processDataForRP(
        data,
        {
          node_id,
          reference_id,
          callback_url,
          requestId: request_id,
          serviceId: service_id,
        },
        {
          synchronous: false,
          apiVersion,
          ndidMemberAppType,
          ndidMemberAppVersion,
        }
      );

      res.status(202).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/error/:request_id/:service_id',
  validateBody,
  async (req, res, next) => {
    try {
      const { request_id, service_id } = req.params;
      const { node_id, reference_id, callback_url, error_code } = req.body;
      const {
        [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
        [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
      } = req.headers;

      await as.processDataForRP(
        undefined,
        {
          node_id,
          reference_id,
          callback_url,
          requestId: request_id,
          serviceId: service_id,
          error_code,
        },
        {
          synchronous: false,
          apiVersion,
          ndidMemberAppType,
          ndidMemberAppVersion,
        }
      );

      res.status(202).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/callback', async (req, res, next) => {
  try {
    const urls = await as.getCallbackUrls();

    if (Object.keys(urls).length > 0) {
      res.status(200).json(urls);
    } else {
      res.status(404).end();
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/callback', validateBody, async (req, res, next) => {
  try {
    const { incoming_request_status_update_url, error_url } = req.body;

    await as.setCallbackUrls({
      incoming_request_status_update_url,
      error_url,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
