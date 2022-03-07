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
import * as coreRequest from '../../../core/request';
import * as coreServicePrice from '../../../core/service_price';
import * as coreMessage from '../../../core/message';
import * as privateMessage from '../../../core/common/private_message';

const router = express.Router();

router.get('/idp', validateQuery, async (req, res, next) => {
  try {
    const {
      min_ial = 0,
      min_aal = 0,
      on_the_fly_support,
      agent,
      filter_for_node_id,
    } = req.query;

    let agentFlag;
    if (agent === 'true') {
      agentFlag = true;
    } else if (agent === 'false') {
      agentFlag = false;
    }

    let onTheFlySupport;
    if (on_the_fly_support === 'true') {
      onTheFlySupport = true;
    } else if (on_the_fly_support === 'false') {
      onTheFlySupport = false;
    }

    const idpNodes = await tendermintNdid.getIdpNodes({
      min_ial: parseFloat(min_ial),
      min_aal: parseFloat(min_aal),
      on_the_fly_support: onTheFlySupport,
      agent: agentFlag,
      filter_for_node_id,
    });

    res.status(200).json(idpNodes);
    next();
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
      const {
        min_ial = 0,
        min_aal = 0,
        on_the_fly_support,
        mode,
        filter_for_node_id,
      } = req.query;

      let onTheFlySupport;
      if (on_the_fly_support === 'true') {
        onTheFlySupport = true;
      } else if (on_the_fly_support === 'false') {
        onTheFlySupport = false;
      }

      const idpNodes = await tendermintNdid.getIdpNodes({
        namespace,
        identifier,
        min_ial: parseFloat(min_ial),
        min_aal: parseFloat(min_aal),
        on_the_fly_support: onTheFlySupport,
        mode_list: mode ? [parseInt(mode)] : undefined,
        filter_for_node_id,
      });

      res.status(200).json(idpNodes);
      next();
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
        next();
        return;
      }
    }
    res.status(200).json(asNodes);
    next();
  } catch (error) {
    next(error);
  }
});

router.get(
  '/as/service_price/:service_id',
  validateQuery,
  async (req, res, next) => {
    try {
      const { service_id } = req.params;
      const { node_id } = req.query;

      const servicePriceList = await coreServicePrice.getServicePriceList({
        nodeId: node_id,
        serviceId: service_id,
      });

      if (servicePriceList == null) {
        res.status(404).end();
      } else {
        res.status(200).json(servicePriceList);
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/service_price_ceiling', validateQuery, async (req, res, next) => {
  try {
    const { service_id } = req.query;

    const servicePriceCeiling = await coreServicePrice.getServicePriceCeiling({
      serviceId: service_id,
    });

    if (servicePriceCeiling == null) {
      res.status(404).end();
    } else {
      res.status(200).json(servicePriceCeiling);
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.get(
  '/service_price_min_effective_datetime_delay',
  validateQuery,
  async (req, res, next) => {
    try {
      const { service_id } = req.query;

      const servicePriceMinEffectiveDatetimeDelay =
        await coreServicePrice.getServicePriceMinEffectiveDatetimeDelay({
          service_id,
        });

      if (servicePriceMinEffectiveDatetimeDelay == null) {
        res.status(404).end();
      } else {
        res.status(200).json(servicePriceMinEffectiveDatetimeDelay);
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/requests/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    const request = await coreRequest.getRequestDetails({
      requestId: request_id,
    });

    if (request == null) {
      res.status(404).end();
      next();
      return;
    }

    res.status(200).json(request);
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/nodes/:node_id', async (req, res, next) => {
  try {
    const { node_id } = req.params;

    const result = await tendermintNdid.getNodeInfo(node_id);

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

router.get('/nodes/:node_id/token', async (req, res, next) => {
  try {
    const { node_id } = req.params;

    const amount = await tendermintNdid.getNodeToken(node_id);

    if (amount == null) {
      res.status(404).end();
    } else {
      res.status(200).json({ amount });
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/namespaces', async (req, res, next) => {
  try {
    res.status(200).json(await tendermintNdid.getNamespaceList());
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/services', async (req, res, next) => {
  try {
    res.status(200).json(await tendermintNdid.getServiceList());
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/services/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    const serviceDetail = await tendermintNdid.getServiceDetail(service_id);

    if (serviceDetail == null) {
      res.status(404).end();
    } else {
      if (serviceDetail.data_schema === 'n/a') {
        delete serviceDetail.data_schema;
      }
      if (serviceDetail.data_schema_version === 'n/a') {
        delete serviceDetail.data_schema_version;
      }

      res.status(200).json(serviceDetail);
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/idp_error_codes', async (req, res, next) => {
  try {
    res.status(200).json(await tendermintNdid.getErrorCodeList('idp'));
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/as_error_codes', async (req, res, next) => {
  try {
    res.status(200).json(await tendermintNdid.getErrorCodeList('as'));
    next();
  } catch (error) {
    next(error);
  }
});

// NOTE: Should not be able to get all since it might run into trouble
// and crash the server if the number of messages are too much to handle
// (e.g. run out of memory)
// router.get('/private_messages', async (req, res, next) => {
//   try {
//     const { type } = req.query;
//     const messages = await privateMessage.getPrivateMessages({ type });
//     res.status(200).json(messages);
//   } catch (error) {
//     next(error);
//   }
// });

router.get('/private_messages/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;
    const { node_id, type } = req.query;
    const messages = await privateMessage.getPrivateMessages({
      nodeId: node_id,
      requestId: request_id,
      type,
    });
    if (messages == null) {
      res.status(404).end();
      next();
      return;
    }
    res.status(200).json(messages);
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/private_message_removal', async (req, res, next) => {
  try {
    const { type } = req.query;
    const { node_id } = req.body;
    await privateMessage.removePrivateMessages({ nodeId: node_id, type });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/private_message_removal/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;
    const { type } = req.query;
    const { node_id } = req.body;
    await privateMessage.removePrivateMessages({
      nodeId: node_id,
      requestId: request_id,
      type,
    });
    res.status(204).end();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/messages/:message_id', async (req, res, next) => {
  try {
    const { message_id } = req.params;

    const message = await coreMessage.getMessageDetails({
      messageId: message_id,
    });

    if (message == null) {
      res.status(404).end();
      next();
      return;
    }

    res.status(200).json(message);
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
