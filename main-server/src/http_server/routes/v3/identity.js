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
import * as tendermintNdid from '../../../tendermint/ndid';

import errorType from 'ndid-error/type';

const router = express.Router();

router.post('/', idpOnlyHandler, validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      reference_id,
      callback_url,
      identity_list,
      mode,
      accessor_type,
      accessor_public_key,
      accessor_id,
      ial,
      request_message,
    } = req.body;

    const result = await identity.createIdentity({
      node_id,
      reference_id,
      callback_url,
      identity_list,
      mode,
      accessor_type,
      accessor_public_key,
      accessor_id,
      ial,
      request_message,
    });

    res.status(202).json(result);
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    const reference_group_code = await tendermintNdid.getReferenceGroupCode(
      namespace,
      identifier
    );

    if (reference_group_code !== null) {
      res.status(200).json({ reference_group_code });
    } else {
      res.status(404).end();
    }
    next();
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
      const { node_id, reference_id, callback_url, identity_list } = req.body;

      // TODO

      res.status(501).end();
      next();
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
    next();
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
      next();
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

    res.status(501).end();
    next();
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

      res.status(501).end();
      next();
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
        request_message,
      } = req.body;

      const { namespace, identifier } = req.params;

      const result = await identity.addAccessor({
        node_id,
        reference_id,
        callback_url,
        namespace,
        identifier,
        accessor_type,
        accessor_public_key,
        accessor_id,
        request_message,
      });

      res.status(202).json(result);
      next();
    } catch (error) {
      if (error.code === errorType.IDENTITY_NOT_FOUND.code) {
        res.status(404).end();
        next();
        return;
      }
      next(error);
    }
  }
);

router.post(
  '/:namespace/:identifier/accessors_revoke',
  validateBody,
  async (req, res, next) => {
    try {
      const {
        node_id,
        reference_id,
        callback_url,
        accessor_id,
        request_message,
      } = req.body;

      const { namespace, identifier } = req.params;

      const result = await identity.revokeAccessor({
        node_id,
        reference_id,
        callback_url,
        namespace,
        identifier,
        accessor_id,
        request_message,
      });

      res.status(202).json(result);
      next();
    } catch (error) {
      if (error.code === errorType.IDENTITY_NOT_FOUND.code) {
        res.status(404).end();
        next();
        return;
      }
      next(error);
    }
  }
);

router.post(
  '/:namespace/:identifier/association_revoke',
  validateBody,
  async (req, res, next) => {
    try {
      const { node_id, reference_id, callback_url, request_message } = req.body;

      const { namespace, identifier } = req.params;

      const result = await identity.revokeIdentityAssociation({
        node_id,
        reference_id,
        callback_url,
        namespace,
        identifier,
        request_message,
      });

      res.status(202).json(result);
      next();
    } catch (error) {
      if (error.code === errorType.IDENTITY_NOT_FOUND.code) {
        res.status(404).end();
        next();
        return;
      }
      next(error);
    }
  }
);

router.post(
  '/:namespace/:identifier/removal_from_reference_group',
  validateBody,
  async (req, res, next) => {
    try {
      const { node_id, reference_id, callback_url, request_message } = req.body;

      const { namespace, identifier } = req.params;

      // const result = await identity.({
      //   node_id,
      //   reference_id,
      //   callback_url,
      //   namespace,
      //   identifier,
      //   request_message,
      // });

      // res.status(202).json(result);
      next();
    } catch (error) {
      if (error.code === errorType.IDENTITY_NOT_FOUND.code) {
        res.status(404).end();
        next();
        return;
      }
      next(error);
    }
  }
);

router.post(
  '/:namespace/:identifier/reference_group_merge',
  validateBody,
  async (req, res, next) => {
    try {
      const {
        node_id,
        reference_id,
        callback_url,
        namespace_to_merge,
        identifier_to_merge,
        request_message,
      } = req.body;

      const { namespace, identifier } = req.params;

      // const result = await identity.({
      //   node_id,
      //   reference_id,
      //   callback_url,
      //   namespace,
      //   identifier,
      //   request_message,
      // });

      // res.status(202).json(result);
      next();
    } catch (error) {
      if (error.code === errorType.IDENTITY_NOT_FOUND.code) {
        res.status(404).end();
        next();
        return;
      }
      next(error);
    }
  }
);

export default router;
