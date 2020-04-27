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
import { ndidOnlyHandler } from '../middleware/role_handler';
import * as ndid from '../../../core/ndid';

const router = express.Router();

router.use(ndidOnlyHandler);

router.post('/init_ndid', validateBody, async (req, res, next) => {
  try {
    const {
      public_key,
      public_key_type,
      master_public_key,
      master_public_key_type,
      chain_history_info,
    } = req.body;

    await ndid.initNDID({
      public_key,
      public_key_type,
      master_public_key,
      master_public_key_type,
      chain_history_info,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/end_init', async (req, res, next) => {
  try {
    await ndid.endInit();
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/set_allowed_mode_list', validateBody, async (req, res, next) => {
  try {
    const { purpose, allowed_mode_list } = req.body;
    await ndid.setAllowedModeList({
      purpose,
      allowed_mode_list,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/register_node', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      node_name,
      node_key,
      node_key_type,
      // node_sign_method,
      node_master_key,
      node_master_key_type,
      // node_master_sign_method,
      role,
      max_aal,
      max_ial,
      agent,
      node_id_whitelist_active,
      node_id_whitelist,
    } = req.body;

    await ndid.registerNode(
      {
        node_id,
        node_name,
        public_key: node_key,
        public_key_type: node_key_type,
        master_public_key: node_master_key,
        master_public_key_type: node_master_key_type,
        role,
        max_aal,
        max_ial,
        agent,
        node_id_whitelist_active,
        node_id_whitelist,
      },
      { synchronous: true }
    );

    res.status(201).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/update_node', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      node_name,
      // role,
      max_aal,
      max_ial,
      agent,
      node_id_whitelist_active,
      node_id_whitelist,
    } = req.body;

    await ndid.updateNode(
      {
        node_id,
        node_name,
        // role,
        max_aal,
        max_ial,
        agent,
        node_id_whitelist_active,
        node_id_whitelist,
      },
      { synchronous: true }
    );

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/enable_node', validateBody, async (req, res, next) => {
  try {
    const { node_id } = req.body;

    await ndid.enableNode({
      node_id,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/disable_node', validateBody, async (req, res, next) => {
  try {
    const { node_id } = req.body;

    await ndid.disableNode({
      node_id,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/set_node_token', validateBody, async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.setNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/add_node_token', validateBody, async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.addNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/reduce_node_token', validateBody, async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.reduceNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/create_namespace', validateBody, async (req, res, next) => {
  try {
    const {
      namespace,
      description,
      allowed_identifier_count_in_reference_group,
      allowed_active_identifier_count_in_reference_group,
    } = req.body;

    await ndid.addNamespace({
      namespace,
      description,
      allowed_identifier_count_in_reference_group,
      allowed_active_identifier_count_in_reference_group,
    });
    res.status(201).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/update_namespace', validateBody, async (req, res, next) => {
  try {
    const {
      namespace,
      description,
      allowed_identifier_count_in_reference_group,
      allowed_active_identifier_count_in_reference_group,
    } = req.body;

    await ndid.updateNamespace({
      namespace,
      description,
      allowed_identifier_count_in_reference_group,
      allowed_active_identifier_count_in_reference_group,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/enable_namespace', validateBody, async (req, res, next) => {
  try {
    const { namespace } = req.body;

    await ndid.enableNamespace({
      namespace,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/disable_namespace', validateBody, async (req, res, next) => {
  try {
    const { namespace } = req.body;

    await ndid.disableNamespace({
      namespace,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/create_service', validateBody, async (req, res, next) => {
  try {
    const {
      service_id,
      service_name,
      data_schema,
      data_schema_version,
    } = req.body;

    await ndid.addService({
      service_id,
      service_name,
      data_schema,
      data_schema_version,
    });
    res.status(201).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/update_service', validateBody, async (req, res, next) => {
  try {
    const {
      service_id,
      service_name,
      data_schema,
      data_schema_version,
    } = req.body;

    await ndid.updateService({
      service_id,
      service_name,
      data_schema,
      data_schema_version,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/enable_service', validateBody, async (req, res, next) => {
  try {
    const { service_id } = req.body;

    await ndid.enableService({
      service_id,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/disable_service', validateBody, async (req, res, next) => {
  try {
    const { service_id } = req.body;

    await ndid.disableService({
      service_id,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/set_validator', validateBody, async (req, res, next) => {
  try {
    const { public_key, power } = req.body;

    await ndid.setValidator({
      public_key,
      power,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/approve_service', validateBody, async (req, res, next) => {
  try {
    await ndid.approveService(req.body);
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/enable_service_destination',
  validateBody,
  async (req, res, next) => {
    try {
      const { service_id, node_id } = req.body;

      await ndid.enableServiceDestination({
        service_id,
        node_id,
      });
      res.status(204).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/disable_service_destination',
  validateBody,
  async (req, res, next) => {
    try {
      const { service_id, node_id } = req.body;

      await ndid.disableServiceDestination({
        service_id,
        node_id,
      });
      res.status(204).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/add_node_to_proxy_node', validateBody, async (req, res, next) => {
  try {
    const { node_id, proxy_node_id, config } = req.body;

    await ndid.addNodeToProxyNode({
      node_id,
      proxy_node_id,
      config,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/update_node_proxy_node', validateBody, async (req, res, next) => {
  try {
    const { node_id, proxy_node_id, config } = req.body;

    await ndid.updateNodeProxyNode({
      node_id,
      proxy_node_id,
      config,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/remove_node_from_proxy_node',
  validateBody,
  async (req, res, next) => {
    try {
      const { node_id } = req.body;

      await ndid.removeNodeFromProxyNode({
        node_id,
      });
      res.status(204).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/set_last_block', validateBody, async (req, res, next) => {
  try {
    const { block_height } = req.body;

    await ndid.setLastBlock({
      block_height,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/get_allowed_min_ial_for_register_identity_at_first_idp',
  async (req, res, next) => {
    try {
      const min_ial = await ndid.getAllowedMinIalForRegisterIdentityAtFirstIdp();
      res.status(200).json({ min_ial });
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/set_allowed_min_ial_for_register_identity_at_first_idp',
  validateBody,
  async (req, res, next) => {
    try {
      const { min_ial } = req.body;

      await ndid.setAllowedMinIalForRegisterIdentityAtFirstIdp({
        min_ial,
      });
      res.status(204).end();
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/get_node_id_list', validateBody, async (req, res, next) => {
  try {
    const { role } = req.body;

    const node_id_list = await ndid.getNodeIdList(role);
    res.status(200).json({ node_id_list });
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/add_error_code', validateBody, async (req, res, next) => {
  try {
    const { error_code, type, description } = req.body;
    await ndid.addErrorCode({ error_code, type, description });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/remove_error_code', validateBody, async (req, res, next) => {
  try {
    const { error_code, type } = req.body;
    await ndid.removeErrorCode({ error_code, type });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
