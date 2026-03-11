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

import { validateBody } from '../../middleware/validation';
import { asOnlyHandler } from '../../middleware/role_handler';
import * as coreYourDataAS from '../../../../core/yourdata/as';

import { apiVersion } from '../version';
import { HTTP_HEADER_FIELDS } from '../private_http_header';

const router = express.Router();

router.use(asOnlyHandler);

router.post('/callback', validateBody, async (req, res, next) => {
  try {
    const { incoming_request_status_update_url } = req.body;

    await coreYourDataAS.setCallbackUrls({
      incoming_request_status_update_url,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/callback', async (req, res, next) => {
  try {
    const urls = await coreYourDataAS.getCallbackUrls();

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

router.post('/service/:service_id', validateBody, async (req, res, next) => {
  try {
    const { service_id } = req.params;
    const {
      node_id,
      service_url,
      supported_namespace_list,
      supported_authorization,
      service_availability,
    } = req.body;

    await coreYourDataAS.registerOrUpdateASService({
      node_id,
      service_id,
      service_url,
      supported_namespace_list,
      supported_authorization,
      service_availability,
    });

    res.status(204).end();

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { service_id } = req.params;

    const result = await coreYourDataAS.getServiceDetail(node_id, service_id);

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

router.post('/data', validateBody, async (req, res, next) => {
  try {
    const { node_id, request_id, data } = req.body;
    const {
      [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
      [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
    } = req.headers;

    await coreYourDataAS.respondDataToRP(
      {
        node_id,
        request_id,
        data,
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
});

router.post('/error', validateBody, async (req, res, next) => {
  try {
    const { node_id, request_id, error_code, error_message } = req.body;
    const {
      [HTTP_HEADER_FIELDS.ndidMemberAppType]: ndidMemberAppType,
      [HTTP_HEADER_FIELDS.ndidMemberAppVersion]: ndidMemberAppVersion,
    } = req.headers;

    await coreYourDataAS.respondErrorToRP(
      {
        node_id,
        request_id,
        error_code,
        error_message,
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
});

router.post('/auto_error_responses', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      bypass_error_code_check,
      service_not_available,
      unsupported_namespace,
      unsupported_authorization,
    } = req.body;

    await coreYourDataAS.setAutoErrorResponses({
      node_id,
      bypass_error_code_check,
      service_not_available,
      unsupported_namespace,
      unsupported_authorization,
    });

    res.status(204).end();

    next();
  } catch (error) {
    next(error);
  }
});

router.get('/auto_error_responses', async (req, res, next) => {
  try {
    const { node_id } = req.query;

    const result = await coreYourDataAS.getAutoErrorResponses({
      node_id,
    });

    res.status(200).json(result);

    next();
  } catch (error) {
    next(error);
  }
});

export default router;
