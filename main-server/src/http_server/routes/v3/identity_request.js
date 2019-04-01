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
import { idpOnlyHandler } from '../middleware/role_handler';
import * as identity from '../../../core/identity';
import * as common from '../../../core/common';

const router = express.Router();

router.post(
  '/request_close',
  idpOnlyHandler,
  validateBody,
  async (req, res, next) => {
    try {
      const { node_id, reference_id, callback_url, request_id } = req.body;

      await common.closeRequest(
        { node_id, reference_id, callback_url, request_id },
        { synchronous: false }
      );
      res.status(202).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/request_references/:reference_id',
  idpOnlyHandler,
  async (req, res, next) => {
    try {
      const { node_id } = req.query;
      const { reference_id } = req.params;

      const identityRequestData = await identity.getIdentityRequestDataByReferenceId(
        node_id,
        reference_id
      );
      const revokeIdentityData = await identity.getRevokeAccessorDataByReferenceId(
        node_id,
        reference_id
      );

      if (identityRequestData != null) {
        if (identityRequestData.type === 'RegisterIdentity') {
          res.status(200).json({
            request_id: identityRequestData.request_id,
            accessor_id: identityRequestData.accessor_id,
          });
        } else if (identityRequestData.type === 'AddAccessor') {
          res.status(200).json({
            request_id: revokeIdentityData.request_id,
            accessor_id: revokeIdentityData.accessor_id,
          });
        } else {
          res.status(500).end(); // FIXME: ?
        }
      } else {
        res.status(404).end();
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
