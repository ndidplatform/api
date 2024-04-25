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

import * as tendermintNdid from '../tendermint/ndid';
import { getErrorObjectForClient } from '../utils/error';
import {
  validateSigningKey,
  validateEncryptionKey,
  verifyNewSigningKey,
} from '../utils/node_key';
import { callbackToClient } from '../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../logger';

import * as config from '../config';

/**
 * Update node
 *
 * @param {Object} updateNodeParams
 * @param {string} [updateNodeParams.node_id]
 * @param {string} updateNodeParams.reference_id
 * @param {string} updateNodeParams.callback_url
 * @param {string} [updateNodeParams.signing_public_key]
 * @param {string} [updateNodeParams.signing_key_algorithm]
 * @param {string} [updateNodeParams.signing_algorithm]
 * @param {string} [updateNodeParams.signing_master_public_key]
 * @param {string} [updateNodeParams.signing_master_key_algorithm]
 * @param {string} [updateNodeParams.signing_master_algorithm]
 * @param {string} [updateNodeParams.encryption_public_key]
 * @param {string} [updateNodeParams.encryption_key_algorithm]
 * @param {string} [updateNodeParams.encryption_algorithm]
 * @param {string} [updateNodeParams.check_string]
 * @param {string} [updateNodeParams.signed_check_string]
 * @param {string} [updateNodeParams.master_signed_check_string]
 * @param {string[]} [updateNodeParams.supported_request_message_data_url_type_list]
 * @param {Object} [options]
 * @param {boolean} [options.synchronous]
 *
 * @returns {Promise<Object>} Request ID and request message salt
 */
export async function updateNode(
  {
    node_id,
    signing_public_key,
    signing_key_algorithm,
    signing_algorithm,
    signing_master_public_key,
    signing_master_key_algorithm,
    signing_master_algorithm,
    encryption_public_key,
    encryption_key_algorithm,
    encryption_algorithm,
    check_string,
    signed_check_string,
    master_signed_check_string,
    supported_request_message_data_url_type_list,
  },
  { synchronous = false } = {}
) {
  if (node_id == null) {
    node_id = config.nodeId;
  }

  // Validate public keys
  if (signing_public_key != null) {
    validateSigningKey(
      signing_public_key,
      signing_key_algorithm,
      signing_algorithm
    );
    if (check_string != null) {
      verifyNewSigningKey(
        signing_algorithm,
        signed_check_string,
        signing_public_key,
        check_string
      );
    }
  }

  if (signing_master_public_key != null) {
    validateSigningKey(
      signing_master_public_key,
      signing_master_key_algorithm,
      signing_master_algorithm
    );
    if (check_string != null) {
      verifyNewSigningKey(
        signing_master_algorithm,
        master_signed_check_string,
        signing_master_public_key,
        check_string,
        true
      );
    }
  }

  if (encryption_public_key != null) {
    validateEncryptionKey(
      encryption_public_key,
      encryption_key_algorithm,
      encryption_algorithm
    );
  }

  if (supported_request_message_data_url_type_list != null) {
    const nodeInfo = await tendermintNdid.getNodeInfo(node_id);
    if (nodeInfo == null) {
      throw new CustomError({
        errorType: errorType.NODE_INFO_NOT_FOUND,
        details: {
          node_id,
        },
      });
    }
    if (nodeInfo.role.toLowerCase() !== 'idp') {
      throw new CustomError({
        errorType: errorType.MUST_BE_IDP_NODE,
      });
    }
  }

  if (synchronous) {
    await updateNodeInternalAsync(...arguments, { nodeId: node_id });
  } else {
    updateNodeInternalAsync(...arguments, { nodeId: node_id });
  }
}

async function updateNodeInternalAsync(
  {
    reference_id,
    callback_url,
    signing_public_key,
    signing_algorithm,
    signing_master_public_key,
    signing_master_algorithm,
    encryption_public_key,
    encryption_algorithm,
    supported_request_message_data_url_type_list,
  },
  { synchronous = false } = {},
  { nodeId }
) {
  try {
    if (!synchronous) {
      await tendermintNdid.updateNode(
        {
          signing_public_key,
          signing_algorithm,
          signing_master_public_key,
          signing_master_algorithm,
          encryption_public_key,
          encryption_algorithm,
          supported_request_message_data_url_type_list,
        },
        nodeId,
        'node.updateNodeInternalAsyncAfterBlockchain',
        [{ nodeId, reference_id, callback_url }, { synchronous }]
      );
    } else {
      await tendermintNdid.updateNode(
        {
          signing_public_key,
          signing_algorithm,
          signing_master_public_key,
          signing_master_algorithm,
          encryption_public_key,
          encryption_algorithm,
          supported_request_message_data_url_type_list,
        },
        nodeId
      );
      await updateNodeInternalAsyncAfterBlockchain(
        {},
        { nodeId, reference_id, callback_url },
        { synchronous }
      );
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
          node_id: nodeId,
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

export async function updateNodeInternalAsyncAfterBlockchain(
  { error },
  { nodeId, reference_id, callback_url },
  { synchronous = false } = {}
) {
  try {
    if (error) throw error;

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'update_node_result',
          reference_id,
          success: true,
        },
        retry: true,
      });
    }
  } catch (error) {
    logger.error({
      message: 'Update node internal async after blockchain error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
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

export async function getNode({ nodeId }) {
  const node = await tendermintNdid.getNodeInfo(nodeId);

  if (node == null) {
    return null;
  }

  if (node.signing_public_key.creation_block_height <= 0) {
    node.signing_public_key.creation_block_height = null;
  }
  if (node.signing_public_key.creation_chain_id === '') {
    node.signing_public_key.creation_chain_id = null;
  }

  if (node.signing_master_public_key.creation_block_height <= 0) {
    node.signing_master_public_key.creation_block_height = null;
  }
  if (node.signing_master_public_key.creation_chain_id === '') {
    node.signing_master_public_key.creation_chain_id = null;
  }

  if (node.encryption_public_key.creation_block_height <= 0) {
    node.encryption_public_key.creation_block_height = null;
  }
  if (node.encryption_public_key.creation_chain_id === '') {
    node.encryption_public_key.creation_chain_id = null;
  }

  if (node.proxy != null) {
    if (node.proxy.signing_public_key.creation_block_height <= 0) {
      node.proxy.signing_public_key.creation_block_height = null;
    }
    if (node.proxy.signing_public_key.creation_chain_id === '') {
      node.proxy.signing_public_key.creation_chain_id = null;
    }

    if (node.proxy.signing_master_public_key.creation_block_height <= 0) {
      node.proxy.signing_master_public_key.creation_block_height = null;
    }
    if (node.proxy.signing_master_public_key.creation_chain_id === '') {
      node.proxy.signing_master_public_key.creation_chain_id = null;
    }

    if (node.proxy.encryption_public_key.creation_block_height <= 0) {
      node.proxy.encryption_public_key.creation_block_height = null;
    }
    if (node.proxy.encryption_public_key.creation_chain_id === '') {
      node.proxy.encryption_public_key.creation_chain_id = null;
    }
  }

  return node;
}

export async function getNodePublicKeyList({ nodeId }) {
  const nodePublicKeyList = await tendermintNdid.getNodePublicKeyList(nodeId);

  nodePublicKeyList.signing_public_key_list =
    nodePublicKeyList.signing_public_key_list.map((nodePublicKey) => {
      if (nodePublicKey.creation_block_height <= 0) {
        nodePublicKey.creation_block_height = null;
      }

      if (nodePublicKey.creation_chain_id === '') {
        nodePublicKey.creation_chain_id = null;
      }

      return nodePublicKey;
    });
  nodePublicKeyList.signing_master_public_key_list =
    nodePublicKeyList.signing_master_public_key_list.map((nodePublicKey) => {
      if (nodePublicKey.creation_block_height <= 0) {
        nodePublicKey.creation_block_height = null;
      }

      if (nodePublicKey.creation_chain_id === '') {
        nodePublicKey.creation_chain_id = null;
      }

      return nodePublicKey;
    });
  nodePublicKeyList.encryption_public_key_list =
    nodePublicKeyList.encryption_public_key_list.map((nodePublicKey) => {
      if (nodePublicKey.creation_block_height <= 0) {
        nodePublicKey.creation_block_height = null;
      }

      if (nodePublicKey.creation_chain_id === '') {
        nodePublicKey.creation_chain_id = null;
      }

      return nodePublicKey;
    });

  return nodePublicKeyList;
}
