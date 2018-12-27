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

import { validateBody } from './middleware/validation';
import { ndidOnlyHandler } from './middleware/role_handler';
import { ndid } from '../../core';

const router = express.Router();

router.use(ndidOnlyHandler);

router.post('/initNDID', validateBody, async (req, res, next) => {
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
  } catch (error) {
    next(error);
  }
});

router.post('/endInit', async (req, res, next) => {
  try {
    await ndid.endInit();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/registerNode', validateBody, async (req, res, next) => {
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
      },
      { synchronous: true }
    );

    res.status(201).end();
  } catch (error) {
    next(error);
  }
});

router.post('/updateNode', validateBody, async (req, res, next) => {
  try {
    const {
      node_id,
      node_name,
      // role,
      max_aal,
      max_ial,
    } = req.body;

    await ndid.updateNode(
      {
        node_id,
        node_name,
        // role,
        max_aal,
        max_ial,
      },
      { synchronous: true }
    );

    res.status(200).end();
  } catch (error) {
    next(error);
  }
});

router.post('/enableNode', validateBody, async (req, res, next) => {
  try {
    const { node_id } = req.body;

    await ndid.enableNode({
      node_id,
    });

    res.status(200).end();
  } catch (error) {
    next(error);
  }
});

router.post('/disableNode', validateBody, async (req, res, next) => {
  try {
    const { node_id } = req.body;

    await ndid.disableNode({
      node_id,
    });

    res.status(200).end();
  } catch (error) {
    next(error);
  }
});

router.post('/setNodeToken', validateBody, async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.setNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/addNodeToken', validateBody, async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.addNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/reduceNodeToken', validateBody, async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.reduceNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/namespaces', validateBody, async (req, res, next) => {
  try {
    const { namespace, description } = req.body;

    if (namespace === 'requests' || namespace === 'housekeeping') {
      res.status(400).json({
        message:
          'Input namespace cannot be reserved words ("requests" and "housekeeping")',
      });
      return;
    }

    await ndid.addNamespace({
      namespace,
      description,
    });
    res.status(201).end();
  } catch (error) {
    next(error);
  }
});

router.post('/namespaces/:namespace/enable', async (req, res, next) => {
  try {
    const { namespace } = req.params;

    await ndid.enableNamespace({
      namespace,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/namespaces/:namespace/disable', async (req, res, next) => {
  try {
    const { namespace } = req.params;

    await ndid.disableNamespace({
      namespace,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/services', validateBody, async (req, res, next) => {
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
  } catch (error) {
    next(error);
  }
});

router.post('/services/:service_id', validateBody, async (req, res, next) => {
  try {
    const { service_id } = req.params;
    const { service_name, data_schema, data_schema_version } = req.body;

    await ndid.updateService({
      service_id,
      service_name,
      data_schema,
      data_schema_version,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/services/:service_id/enable', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    await ndid.enableService({
      service_id,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/services/:service_id/disable', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    await ndid.disableService({
      service_id,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/validator', validateBody, async (req, res, next) => {
  try {
    const { public_key, power } = req.body;

    await ndid.setValidator({
      public_key,
      power,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/setTimeoutBlockRegisterIdentity',
  validateBody,
  async (req, res, next) => {
    try {
      const { blocks_to_timeout } = req.body;

      await ndid.setTimeoutBlockRegisterIdentity({
        blocks_to_timeout,
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/approveService', validateBody, async (req, res, next) => {
  try {
    await ndid.approveService(req.body);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/enableServiceDestination',
  validateBody,
  async (req, res, next) => {
    try {
      const { service_id, node_id } = req.body;

      await ndid.enableServiceDestination({
        service_id,
        node_id,
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/disableServiceDestination',
  validateBody,
  async (req, res, next) => {
    try {
      const { service_id, node_id } = req.body;

      await ndid.disableServiceDestination({
        service_id,
        node_id,
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/addNodeToProxyNode', validateBody, async (req, res, next) => {
  try {
    const { node_id, proxy_node_id, config } = req.body;

    await ndid.addNodeToProxyNode({
      node_id,
      proxy_node_id,
      config,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/updateNodeProxyNode', validateBody, async (req, res, next) => {
  try {
    const { node_id, proxy_node_id, config } = req.body;

    await ndid.updateNodeProxyNode({
      node_id,
      proxy_node_id,
      config,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/removeNodeFromProxyNode',
  validateBody,
  async (req, res, next) => {
    try {
      const { node_id } = req.body;

      await ndid.removeNodeFromProxyNode({
        node_id,
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

router.post('/setLastBlock', validateBody, async (req, res, next) => {
  try {
    const { block_height } = req.body;

    await ndid.setLastBlock({
      block_height,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
