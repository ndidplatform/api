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

import validateDataSchema from './data_schema_validator';

import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import logger from '../../logger';
import { validateKey } from '../../utils/node_key';
import { callbackToClient } from '../../utils/callback';

import CustomError from 'ndid-error/custom_error';
import { getErrorObjectForClient } from '../../utils/error';

import * as config from '../../config';

let init = false;

export async function initNDID({
  public_key,
  public_key_type,
  master_public_key,
  master_public_key_type,
}) {
  if (init) {
    logger.error({
      message: 'NDID is already exist',
    });
    return false;
  }
  try {
    if (public_key != null) {
      validateKey(public_key, public_key_type);
    }

    if (master_public_key != null) {
      validateKey(master_public_key, master_public_key_type);
    }

    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'InitNDID',
      params: { node_id: 'ndid1', public_key, master_public_key },
    });
  } catch (error) {
    logger.error({
      message: 'Cannot init NDID',
      error,
    });
    throw error;
  }
}

export async function approveService({ node_id, service_id }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'RegisterServiceDestinationByNDID',
      params: { node_id, service_id },
    });
  } catch (error) {
    logger.error({
      message: 'Cannot approve service for AS',
      error,
    });
    throw error;
  }
}

export async function setNodeToken(data) {
  const { node_id, amount } = data;

  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'SetNodeToken',
      params: data,
    });
  } catch (error) {
    logger.error({
      message: 'Cannot set node token',
      error,
    });
    throw error;
  }
}

export async function addNodeToken(data) {
  const { node_id, amount } = data;

  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'AddNodeToken',
      params: data,
    });
  } catch (error) {
    logger.error({
      message: 'Cannot add node token',
      error,
    });
    throw error;
  }
}

export async function reduceNodeToken(data) {
  const { node_id, amount } = data;

  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'ReduceNodeToken',
      params: data,
    });
  } catch (error) {
    logger.error({
      message: 'Cannot reduce node token',
      error,
    });
    throw error;
  }
}

export async function registerNode(data, { synchronous = false } = {}) {
  try {
    if (data.public_key != null) {
      validateKey(data.public_key, data.public_key_type);
    }

    if (data.master_public_key != null) {
      validateKey(data.master_public_key, data.master_public_key_type);
    }

    if (synchronous) {
      await registerNodeInternalAsync(...arguments);
    } else {
      registerNodeInternalAsync(...arguments);
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot register node',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function registerNodeInternalAsync(data, { synchronous = false } = {}) {
  const {
    reference_id,
    callback_url,
    node_id,
    node_name,
    public_key,
    master_public_key,
    role,
    max_ial,
    max_aal,
  } = data;

  data.role = data.role.toUpperCase();
  if (data.role === 'IDP') {
    data.role = 'IdP';
    if (max_ial == null || max_aal == null) {
      throw new CustomError({
        message: 'IdP role must have property "max_ial" and "max_aal"',
      });
    }
  } else {
    if (max_ial != null || max_aal != null) {
      throw new CustomError({
        message:
          'Roles other than IdP should not have property "max_ial" and/or "max_aal"',
      });
    }
  }

  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'RegisterNode',
      params: data,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          node_id: config.nodeId,
          type: 'create_node_result',
          reference_id,
          success: true,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: 'Register node internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          node_id: config.nodeId,
          type: 'create_node_result',
          reference_id,
          success: false,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}

export async function updateNode(data, { synchronous = false } = {}) {
  try {
    if (synchronous) {
      await updateNodeInternalAsync(...arguments);
    } else {
      updateNodeInternalAsync(...arguments);
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot update node',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function updateNodeInternalAsync(data, { synchronous = false } = {}) {
  const {
    reference_id,
    callback_url,
    node_id,
    node_name,
    // role,
    max_ial,
    max_aal,
  } = data;

  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'UpdateNodeByNDID',
      params: data,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          node_id: config.nodeId,
          type: 'update_node_result',
          reference_id,
          success: true,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: 'Update node internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          node_id: config.nodeId,
          type: 'update_node_result',
          reference_id,
          success: false,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}

export async function addNamespace({ namespace, description }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'AddNamespace',
      params: { namespace, description },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function enableNamespace({ namespace }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'EnableNamespace',
      params: { namespace },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function disableNamespace({ namespace }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'DisableNamespace',
      params: { namespace },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function addService({
  service_id,
  service_name,
  data_schema,
  data_schema_version,
}) {
  try {
    if (data_schema != null && data_schema !== 'n/a') {
      const validationResult = validateDataSchema(data_schema);
      if (!validationResult.valid) {
        throw new CustomError({
          message: 'Invalid data schema schema',
        });
      }
    }

    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'AddService',
      params: { service_id, service_name, data_schema, data_schema_version },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function updateService({
  service_id,
  service_name,
  data_schema,
  data_schema_version,
}) {
  try {
    if (data_schema != null && data_schema !== 'n/a') {
      const validationResult = validateDataSchema(data_schema);
      if (!validationResult.valid) {
        throw new CustomError({
          message: 'Invalid data schema schema',
        });
      }
    }

    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'UpdateService',
      params: { service_id, service_name, data_schema, data_schema_version },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function enableService({ service_id }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'EnableService',
      params: { service_id },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function disableService({ service_id }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'DisableService',
      params: { service_id },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function setValidator({ public_key, power }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'SetValidator',
      params: { public_key, power },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function setTimeoutBlockRegisterIdentity({ blocks_to_timeout }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'SetTimeOutBlockRegisterIdentity',
      params: { time_out_block: blocks_to_timeout },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function enableServiceDestination({ service_id, node_id }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'EnableServiceDestinationByNDID',
      params: { service_id, node_id },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function disableServiceDestination({ service_id, node_id }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'DisableServiceDestinationByNDID',
      params: { service_id, node_id },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function addNodeToProxyNode({
  node_id,
  proxy_node_id,
  config: nodeProxyConfig,
}) {
  try {
    await tendermintNdid.addNodeToProxyNode(
      { node_id, proxy_node_id, config: nodeProxyConfig },
      config.nodeId
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function updateNodeProxyNode({
  node_id,
  proxy_node_id,
  config: nodeProxyConfig,
}) {
  try {
    await tendermintNdid.updateNodeProxyNode(
      { node_id, proxy_node_id, config: nodeProxyConfig },
      config.nodeId
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function removeNodeFromProxyNode({ node_id }) {
  try {
    await tendermintNdid.removeNodeFromProxyNode({ node_id }, config.nodeId);
  } catch (error) {
    // TODO:
    throw error;
  }
}
