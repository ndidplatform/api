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
import * as identity from '../../core/identity';
import * as common from '../../core/common';
import * as tendermintNdid from '../../tendermint/ndid';

import errorType from '../../error/type';

const router = express.Router();

router.post('/', idpOnlyHandler, validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      reference_id,
      callback_url,
      namespace,
      identifier,
      accessor_type,
      accessor_public_key,
      accessor_id,
      ial,
    } = req.body;

    const result = await identity.createIdentity(
      {
        node_id,
        reference_id,
        callback_url,
        namespace,
        identifier,
        accessor_type,
        accessor_public_key,
        accessor_id,
        ial,
      },
      { synchronous: false }
    );

    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/requests/reference/:reference_id',
  idpOnlyHandler,
  async (req, res, next) => {
    try {
      const { node_id } = req.query;
      const { reference_id } = req.params;

      const createIdentityData = await identity.getCreateIdentityDataByReferenceId(
        node_id,
        reference_id
      );
      if (createIdentityData != null) {
        res.status(200).json({
          request_id: createIdentityData.request_id,
          accessor_id: createIdentityData.accessor_id,
        });
      } else {
        res.status(404).end();
      }
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/requests/close',
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
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    const idpNodes = await tendermintNdid.getIdpNodes({
      namespace,
      identifier,
      min_ial: 0,
      min_aal: 0,
    });

    if (idpNodes.length !== 0) {
      res.status(204).end();
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:namespace/:identifier',
  idpOnlyHandler,
  validateBody,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { node_id, reference_id, callback_url, identifier_list } = req.body;

      // Not Implemented
      // TODO

      res.status(501).end();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:namespace/:identifier/ial', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { namespace, identifier } = req.params;

    const idenityInfo = await identity.getIdentityInfo({
      nodeId: node_id,
      namespace,
      identifier,
    });

    if (idenityInfo != null) {
      res.status(200).json({
        ial: idenityInfo.ial,
      });
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:namespace/:identifier/ial',
  idpOnlyHandler,
  validateBody,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { node_id, reference_id, callback_url, ial } = req.body;
      await identity.updateIal(
        {
          node_id,
          reference_id,
          callback_url,
          namespace,
          identifier,
          ial,
        },
        { synchronous: false }
      );
      res.status(202).end();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:namespace/:identifier/endorsement', async (req, res, next) => {
  try {
    const { node_id } = req.query;
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:namespace/:identifier/endorsement',
  validateBody,
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const {
        node_id,
        reference_id,
        callback_url,
        accessor_type,
        accessor_key,
        accessor_id,
      } = req.body;

      // Not Implemented
      // TODO

      res.status(501).end();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:namespace/:identifier/accessors',
  idpOnlyHandler,
  validateBody,
  async (req, res, next) => {
    try {
      const {
        node_id,
        reference_id,
        callback_url,
        accessor_type,
        accessor_public_key,
        accessor_id,
      } = req.body;

      const { namespace, identifier } = req.params;

      const result = await identity.addAccessorMethodForAssociatedIdp(
        {
          node_id,
          reference_id,
          callback_url,
          namespace,
          identifier,
          accessor_type,
          accessor_public_key,
          accessor_id,
        },
        { synchronous: false }
      );

      res.status(202).json(result);
    } catch (error) {
      if (error.code === errorType.IDENTITY_NOT_FOUND.code) {
        res.status(404).end();
        return;
      }
      next(error);
    }
  }
);

router.post('/secret', idpOnlyHandler, async (req, res, next) => {
  try {
    const {
      node_id,
      accessor_id,
      namespace,
      identifier,
      reference_id,
    } = req.body;
    const secret = await identity.calculateSecret({
      node_id,
      accessor_id,
      namespace,
      identifier,
      reference_id,
    });
    res.status(200).json({ secret });
  } catch (error) {
    next(error);
  }
});

export default router;
