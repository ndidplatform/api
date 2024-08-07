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
import {
  validateSigningKey,
  validateEncryptionKey,
} from '../../utils/node_key';
import { callbackToClient } from '../../callback';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';

import * as config from '../../config';

let init = false;

export async function initNDID({
  signing_public_key,
  signing_key_algorithm,
  signing_algorithm,
  signing_master_public_key,
  signing_master_key_algorithm,
  signing_master_algorithm,
  encryption_public_key,
  encryption_key_algorithm,
  encryption_algorithm,
  chain_history_info,
}) {
  if (init) {
    logger.error({
      message: 'NDID already exists',
    });
    return false;
  }
  try {
    if (signing_public_key != null) {
      validateSigningKey(
        signing_public_key,
        signing_key_algorithm,
        signing_algorithm
      );
    }

    if (signing_master_public_key != null) {
      validateSigningKey(
        signing_master_public_key,
        signing_master_key_algorithm,
        signing_master_algorithm
      );
    }

    if (encryption_public_key != null) {
      validateEncryptionKey(
        encryption_public_key,
        encryption_key_algorithm,
        encryption_algorithm
      );
    }

    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'InitNDID',
      params: {
        node_id: config.nodeId,
        signing_public_key,
        signing_algorithm,
        signing_master_public_key,
        signing_master_algorithm,
        encryption_public_key,
        encryption_algorithm,
        chain_history_info: JSON.stringify(chain_history_info),
      },
      signingAlgorithm: signing_algorithm,
    });
  } catch (error) {
    logger.error({
      message: 'Cannot init NDID',
      err: error,
    });
    throw error;
  }
}

export async function endInit() {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'EndInit',
      params: {},
    });
  } catch (error) {
    logger.error({
      message: 'Cannot end init',
      err: error,
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
      err: error,
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
      err: error,
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
      err: error,
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
      err: error,
    });
    throw error;
  }
}

export async function registerNode(data, { synchronous = false } = {}) {
  const { max_ial, max_aal } = data;

  try {
    if (data.signing_public_key != null) {
      validateSigningKey(
        data.signing_public_key,
        data.signing_key_algorithm,
        data.signing_algorithm
      );
    }

    if (data.signing_master_public_key != null) {
      validateSigningKey(
        data.signing_master_public_key,
        data.signing_master_key_algorithm,
        data.signing_master_algorithm
      );
    }

    if (data.encryption_public_key != null) {
      validateEncryptionKey(
        data.encryption_public_key,
        data.encryption_key_algorithm,
        data.encryption_algorithm
      );
    }

    if (data.role.toLowerCase() === 'idp') {
      if (max_ial == null || max_aal == null) {
        throw new CustomError({
          message: 'IdP role must have property "max_ial" and "max_aal"',
        });
      }

      // validate IAL
      const { supported_ial_list } = await tendermintNdid.getSupportedIALList();
      if (!supported_ial_list.includes(max_ial)) {
        throw new CustomError({
          errorType: errorType.UNSUPPORTED_IAL,
          details: {
            supported_ial_list,
            max_ial,
          },
        });
      }

      // validate AAL
      const { supported_aal_list } = await tendermintNdid.getSupportedAALList();
      if (!supported_aal_list.includes(max_aal)) {
        throw new CustomError({
          errorType: errorType.UNSUPPORTED_AAL,
          details: {
            supported_aal_list,
            max_aal,
          },
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
    logger.error({ err });
    throw err;
  }
}

async function registerNodeInternalAsync(data, { synchronous = false } = {}) {
  const { reference_id, callback_url } = data;

  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'RegisterNode',
      params: {
        node_id: data.node_id,
        signing_public_key: data.signing_public_key,
        signing_algorithm: data.signing_algorithm,
        signing_master_public_key: data.signing_master_public_key,
        signing_master_algorithm: data.signing_master_algorithm,
        encryption_public_key: data.encryption_public_key,
        encryption_algorithm: data.encryption_algorithm,
        node_name: data.node_name,
        role: data.role,
        max_ial: data.max_ial,
        max_aal: data.max_aal,
        supported_feature_list: data.supported_feature_list,
        agent: data.agent,
        node_id_whitelist_active: data.node_id_whitelist_active,
        node_id_whitelist: data.node_id_whitelist,
      },
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: config.nodeId,
          type: 'create_node_result',
          reference_id,
          success: true,
        },
        retry: true,
      });
    }
  } catch (error) {
    logger.error({
      message: 'Register node internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: config.nodeId,
          type: 'create_node_result',
          reference_id,
          success: false,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    }

    throw error;
  }
}

export async function updateNode(data, { synchronous = false } = {}) {
  const { max_ial, max_aal } = data;

  try {
    if (max_ial) {
      // validate IAL
      const { supported_ial_list } = await tendermintNdid.getSupportedIALList();
      if (!supported_ial_list.includes(max_ial)) {
        throw new CustomError({
          errorType: errorType.UNSUPPORTED_IAL,
          details: {
            supported_ial_list,
            max_ial,
          },
        });
      }
    }

    if (max_aal) {
      // validate AAL
      const { supported_aal_list } = await tendermintNdid.getSupportedAALList();
      if (!supported_aal_list.includes(max_aal)) {
        throw new CustomError({
          errorType: errorType.UNSUPPORTED_AAL,
          details: {
            supported_aal_list,
            max_aal,
          },
        });
      }
    }

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
    logger.error({ err });
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
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: config.nodeId,
          type: 'update_node_result',
          reference_id,
          success: true,
        },
        retry: true,
      });
    }
  } catch (error) {
    logger.error({
      message: 'Update node internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: config.nodeId,
          type: 'update_node_result',
          reference_id,
          success: false,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    }

    throw error;
  }
}

export async function setAllowedModeList({ purpose, allowed_mode_list }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'SetAllowedModeList',
      params: {
        purpose,
        allowed_mode_list,
      },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function enableNode({ node_id }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'EnableNode',
      params: { node_id },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function disableNode({ node_id }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'DisableNode',
      params: { node_id },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function addNamespace({
  namespace,
  description,
  allowed_identifier_count_in_reference_group,
  allowed_active_identifier_count_in_reference_group,
}) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'AddNamespace',
      params: {
        namespace,
        description,
        allowed_identifier_count_in_reference_group,
        allowed_active_identifier_count_in_reference_group,
      },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function updateNamespace({
  namespace,
  description,
  allowed_identifier_count_in_reference_group,
  allowed_active_identifier_count_in_reference_group,
}) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'UpdateNamespace',
      params: {
        namespace,
        description,
        allowed_identifier_count_in_reference_group,
        allowed_active_identifier_count_in_reference_group,
      },
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

export async function setServicePriceCeiling({
  service_id,
  price_ceiling_by_currency_list,
}) {
  return await tendermintNdid.setServicePriceCeiling(
    { service_id, price_ceiling_by_currency_list },
    config.nodeId
  );
}

export async function setServicePriceMinEffectiveDatetimeDelay({
  service_id,
  duration_second,
}) {
  return await tendermintNdid.setServicePriceMinEffectiveDatetimeDelay(
    {
      service_id,
      duration_second,
    },
    config.nodeId
  );
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

export async function setLastBlock({ block_height }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'SetLastBlock',
      params: { block_height },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function getAllowedMinIalForRegisterIdentityAtFirstIdp() {
  try {
    return await tendermintNdid.getAllowedMinIalForRegisterIdentityAtFirstIdp();
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function setAllowedMinIalForRegisterIdentityAtFirstIdp({
  min_ial,
}) {
  try {
    // validate IAL
    const { supported_ial_list } = await tendermintNdid.getSupportedIALList();
    if (!supported_ial_list.includes(min_ial)) {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_IAL,
        details: {
          supported_ial_list,
          min_ial,
        },
      });
    }

    await tendermintNdid.setAllowedMinIalForRegisterIdentityAtFirstIdp(
      { min_ial },
      config.nodeId
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function getNodeIdList(role) {
  try {
    return await tendermintNdid.getNodeIdList(role);
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function addErrorCode({ error_code, type, description }) {
  try {
    await tendermintNdid.addErrorCode(
      { error_code, type, description },
      config.nodeId
    );
  } catch (error) {
    throw error;
  }
}

export async function removeErrorCode({ error_code, type }) {
  try {
    await tendermintNdid.removeErrorCode({ error_code, type }, config.nodeId);
  } catch (error) {
    throw error;
  }
}

export async function addRequestType({ name }) {
  try {
    await tendermintNdid.addRequestType({ name }, config.nodeId);
  } catch (error) {
    throw error;
  }
}

export async function removeRequestType({ name }) {
  try {
    await tendermintNdid.removeRequestType({ name }, config.nodeId);
  } catch (error) {
    throw error;
  }
}

export async function addSuppressedIdentityModificationNotificationNode({
  node_id,
}) {
  try {
    await tendermintNdid.addSuppressedIdentityModificationNotificationNode(
      { node_id },
      config.nodeId
    );
  } catch (error) {
    throw error;
  }
}

export async function removeSuppressedIdentityModificationNotificationNode({
  node_id,
}) {
  try {
    await tendermintNdid.removeSuppressedIdentityModificationNotificationNode(
      { node_id },
      config.nodeId
    );
  } catch (error) {
    throw error;
  }
}

export async function addAllowedNodeSupportedFeature({ name }) {
  try {
    await tendermintNdid.addAllowedNodeSupportedFeature(
      { name },
      config.nodeId
    );
  } catch (error) {
    throw error;
  }
}

export async function removeAllowedNodeSupportedFeature({ name }) {
  try {
    await tendermintNdid.removeAllowedNodeSupportedFeature(
      { name },
      config.nodeId
    );
  } catch (error) {
    throw error;
  }
}

export async function setSupportedIALList({ supported_ial_list }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'SetSupportedIALList',
      params: {
        supported_ial_list,
      },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function setSupportedAALList({ supported_aal_list }) {
  try {
    await tendermint.transact({
      nodeId: config.nodeId,
      fnName: 'SetSupportedAALList',
      params: {
        supported_aal_list,
      },
    });
  } catch (error) {
    // TODO:
    throw error;
  }
}
