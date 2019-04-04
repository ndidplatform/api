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

import * as tendermint from '.';
import * as utils from '../utils';
import * as config from '../config';

import CustomError from 'ndid-error/custom_error';

//
// Transact
//

export async function setMqAddresses(
  addresses,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if (nodeId == null) {
    nodeId = config.nodeId;
  }
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'SetMqAddresses',
      params: {
        addresses,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register message queue addresses to blockchain',
      cause: error,
    });
  }
}

export async function updateNode(
  { public_key, master_public_key },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    const { success } = await tendermint.transact({
      nodeId,
      fnName: 'UpdateNode',
      params: {
        public_key,
        master_public_key,
      },
      callbackFnName,
      callbackAdditionalArgs,
      useMasterKey: true,
      saveForRetryOnChainDisabled,
    });
    return success;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot update node keys to blockchain',
      cause: error,
    });
  }
}

/**
 *
 * @param {Object} identity
 * @param {string} identity.reference_group_code
 * @param {Object[]} identity.new_identity_list
 * @param {string} identity.new_identity_list[].namespace
 * @param {string} identity.new_identity_list[].identifier
 * @param {string} identity.ial
 * @param {string} identity.mode_list
 * @param {string} identity.accessor_id
 * @param {string} identity.accessor_public_key
 * @param {string} identity.accessor_type
 * @param {string} identity.request_id
 * @param {string} nodeId
 * @param {string} callbackFnName
 * @param {Array} callbackAdditionalArgs
 * @param {boolean} saveForRetryOnChainDisabled
 */
export async function registerIdentity(
  {
    reference_group_code,
    new_identity_list,
    ial,
    mode_list,
    accessor_id,
    accessor_public_key,
    accessor_type,
    request_id,
  },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    new_identity_list = new_identity_list.map(({ namespace, identifier }) => ({
      identity_namespace: namespace,
      identity_identifier_hash: utils.hash(identifier),
    }));

    const result = await tendermint.transact({
      nodeId,
      fnName: 'RegisterIdentity',
      params: {
        reference_group_code,
        new_identity_list,
        ial,
        mode_list,
        accessor_id,
        accessor_public_key,
        accessor_type,
        request_id,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register identity to blockchain',
      cause: error,
    });
  }
}

export async function addAccessor(
  {
    reference_group_code,
    namespace,
    identifier,
    accessor_id,
    accessor_public_key,
    accessor_type,
    request_id,
  },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  if (!reference_group_code && (!namespace || !identifier)) {
    throw new Error('Missing args');
  }
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'AddAccessor',
      params: {
        reference_group_code,
        identity_namespace: namespace,
        identity_identifier_hash: identifier
          ? utils.hash(identifier)
          : undefined,
        accessor_id,
        accessor_public_key,
        accessor_type,
        request_id,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot add accessor to blockchain',
      cause: error,
    });
  }
}

export async function revokeAccessor(
  { request_id, accessor_id },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'RevokeAccessor',
      params: {
        request_id,
        accessor_id_list: [accessor_id],
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot revoke accessor from blockchain',
      cause: error,
    });
  }
}

export async function upgradeIdentityMode(
  { reference_group_code, namespace, identifier, mode, request_id },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  if (!reference_group_code && (!namespace || !identifier)) {
    throw new Error('Missing args');
  }
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'UpgradeIdentityMode',
      params: {
        reference_group_code,
        identity_namespace: namespace,
        identity_identifier_hash: identifier
          ? utils.hash(identifier)
          : undefined,
        mode,
        request_id,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot upgrade identity mode to blockchain',
      cause: error,
    });
  }
}

export async function revokeIdentityAssociation(
  { reference_group_code, namespace, identifier, request_id },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  if (!reference_group_code && (!namespace || !identifier)) {
    throw new Error('Missing args');
  }
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'RevokeIdentityAssociation',
      params: {
        reference_group_code,
        identity_namespace: namespace,
        identity_identifier_hash: identifier
          ? utils.hash(identifier)
          : undefined,
        request_id,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot revoke identity from blockchain',
      cause: error,
    });
  }
}

export async function mergeReferenceGroup(
  {
    reference_group_code,
    namespace,
    identifier,
    reference_group_code_to_merge,
    namespace_to_merge,
    identifier_to_merge,
    request_id,
  },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  if (!reference_group_code && (!namespace || !identifier)) {
    throw new Error('Missing args');
  }

  if (
    reference_group_code_to_merge &&
    (namespace_to_merge || identifier_to_merge)
  ) {
    throw new Error(
      'Cannot have both "reference_group_code_to_merge" and "namespace_to_merge"+"identifier_to_merge" in args'
    );
  }
  if (
    !reference_group_code_to_merge &&
    (!namespace_to_merge || identifier_to_merge)
  ) {
    throw new Error('Missing args');
  }

  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'MergeReferenceGroup',
      params: {
        reference_group_code,
        identity_namespace: namespace,
        identity_identifier_hash: identifier
          ? utils.hash(identifier)
          : undefined,
        reference_group_code_to_merge,
        identity_namespace_to_merge: namespace_to_merge,
        identity_identifier_hash_to_merge: identifier_to_merge
          ? utils.hash(identifier_to_merge)
          : undefined,
        request_id,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot merge reference group in blockchain',
      cause: error,
    });
  }
}

export async function createRequest(
  requestDataToBlockchain,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'CreateRequest',
      params: requestDataToBlockchain,
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot create request to blockchain',
      cause: error,
    });
  }
}

export async function closeRequest(
  { requestId, responseValidList },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    const result = await tendermint.transact({
      nodeId,
      fnName: 'CloseRequest',
      params: { request_id: requestId, response_valid_list: responseValidList },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot close a request to blockchain',
      cause: error,
      requestId,
    });
  }
}

export async function timeoutRequest(
  { requestId, responseValidList },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    // FIXME: should not check here?
    const request = await getRequest({ requestId });
    if (request.closed === false) {
      await tendermint.transact({
        nodeId,
        fnName: 'TimeOutRequest',
        params: {
          request_id: requestId,
          response_valid_list: responseValidList,
        },
        callbackFnName,
        callbackAdditionalArgs,
        saveForRetryOnChainDisabled,
      });
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot timeout request',
      cause: error,
    });
  }
}

export async function setDataReceived(
  { requestId, service_id, as_id },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    const result = await tendermint.transact({
      nodeId,
      fnName: 'SetDataReceived',
      params: {
        request_id: requestId,
        service_id,
        as_id,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot set data received to blockchain',
      cause: error,
      requestId,
      service_id,
      as_id,
    });
  }
}

export async function updateIal(
  { reference_group_code, namespace, identifier, ial },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  if (!reference_group_code && (!namespace || !identifier)) {
    throw new Error('Missing args');
  }
  try {
    await tendermint.transact({
      nodeId,
      fnName: 'UpdateIdentity',
      params: {
        reference_group_code,
        identity_namespace: namespace,
        identity_identifier_hash: identifier
          ? utils.hash(identifier)
          : undefined,
        ial,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot update Ial',
      cause: error,
      reference_group_code,
      namespace,
      identifier,
      ial,
    });
  }
}

/**
 *
 * @param {Object} responseDataToBlockchain
 * @param {number} responseDataToBlockchain.aal
 * @param {number} responseDataToBlockchain.ial
 * @param {string} responseDataToBlockchain.request_id
 * @param {string} responseDataToBlockchain.signature
 * @param {string} responseDataToBlockchain.status
 * @param {stirng} nodeId
 * @param {string} callbackFnName
 * @param {Array} callbackAdditionalArgs
 * @param {boolean} saveForRetryOnChainDisabled
 */
export async function createIdpResponse(
  responseDataToBlockchain,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'CreateIdpResponse',
      params: responseDataToBlockchain,
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot create IdP response to blockchain',
      cause: error,
    });
  }
}

export async function signASData(
  data,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  const dataToBlockchain = {
    request_id: data.request_id,
    signature: data.signature,
    service_id: data.service_id,
  };
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'SignData',
      params: dataToBlockchain,
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot sign AS data',
      cause: error,
    });
  }
}

/**
 *
 * @param {Object} params
 * @param {number} params.min_aal
 * @param {number} params.min_ial
 * @param {string} params.service_id
 * @param {string[]} params.accepted_namespace_list
 * @param {string} nodeId
 * @param {string} callbackFnName
 * @param {Array} callbackAdditionalArgs
 * @param {boolean} saveForRetryOnChainDisabled
 */
export async function registerServiceDestination(
  params,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    await tendermint.transact({
      nodeId,
      fnName: 'RegisterServiceDestination',
      params,
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register service destination',
      cause: error,
    });
  }
}

/**
 *
 * @param {Object} params
 * @param {number} params.min_aal
 * @param {number} params.min_ial
 * @param {string} params.service_id
 * @param {string[]} params.accepted_namespace_list
 * @param {string} nodeId
 * @param {string} callbackFnName
 * @param {Array} callbackAdditionalArgs
 * @param {boolean} saveForRetryOnChainDisabled
 */
export async function updateServiceDestination(
  params,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    await tendermint.transact({
      nodeId,
      fnName: 'UpdateServiceDestination',
      params,
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot update service destination',
      cause: error,
    });
  }
}

//
// Query
//
export async function getAllowedModeList(purpose = '') {
  try {
    const result = await tendermint.query('GetAllowedModeList', { purpose });
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get allowed mode list',
      cause: error,
    });
  }
}

export async function getChainHistory() {
  try {
    const result = await tendermint.query('GetChainHistory');
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get chain history',
      cause: error,
    });
  }
}

export async function getNodePubKey(node_id) {
  try {
    const result = await tendermint.query('GetNodePublicKey', { node_id });
    if (result == null) {
      return null;
    }
    return result.public_key;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node public key from blockchain',
      cause: error,
    });
  }
}

export async function getNodeMasterPubKey(node_id) {
  try {
    const result = await tendermint.query('GetNodeMasterPublicKey', {
      node_id,
    });
    if (result == null) {
      return null;
    }
    return result.master_public_key;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node master public key from blockchain',
      cause: error,
    });
  }
}

export async function getMqAddresses(node_id) {
  try {
    return await tendermint.query('GetMqAddresses', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get message queue address from blockchain',
      cause: error,
    });
  }
}

export async function getNodeToken(node_id = config.nodeId) {
  try {
    const result = await tendermint.query('GetNodeToken', { node_id });
    if (result == null) {
      return null;
    }
    return result.amount;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node token from blockchain',
      cause: error,
    });
  }
}

export async function getRequest({ requestId }) {
  try {
    return await tendermint.query('GetRequest', { request_id: requestId });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get request from blockchain',
      cause: error,
    });
  }
}

export async function getRequestDetail({ requestId, height }) {
  try {
    const requestDetail = await tendermint.query(
      'GetRequestDetail',
      { request_id: requestId },
      height
    );
    if (requestDetail == null) {
      return null;
    }
    const requestStatus = utils.getDetailedRequestStatus(requestDetail);
    return {
      ...requestDetail,
      status: requestStatus.status,
    };
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get request details from blockchain',
      cause: error,
    });
  }
}

export async function getIdpNodes({
  reference_group_code,
  namespace,
  identifier,
  min_ial,
  min_aal,
  node_id_list,
}) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  if (!reference_group_code && (!namespace || !identifier)) {
    throw new Error('Missing args');
  }
  try {
    const result = await tendermint.query('GetIdpNodes', {
      reference_group_code,
      identity_namespace: namespace,
      identity_identifier_hash: identifier ? utils.hash(identifier) : undefined,
      min_ial,
      min_aal,
      node_id_list,
    });
    return result != null ? (result.node != null ? result.node : []) : [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get IdP nodes from blockchain',
      cause: error,
    });
  }
}

export async function getIdpNodesInfo({
  reference_group_code,
  namespace,
  identifier,
  min_ial,
  min_aal,
  node_id_list,
}) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  // Commented out for mode 1
  // if (!reference_group_code && (!namespace || !identifier)) {
  //   throw new Error('Missing args');
  // }
  try {
    const result = await tendermint.query('GetIdpNodesInfo', {
      reference_group_code,
      identity_namespace: namespace,
      identity_identifier_hash: identifier ? utils.hash(identifier) : undefined,
      min_ial,
      min_aal,
      node_id_list,
    });
    return result != null ? (result.node != null ? result.node : []) : [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get IdP nodes from blockchain',
      cause: error,
    });
  }
}

export async function getAsNodesByServiceId({ service_id, node_id_list }) {
  try {
    const result = await tendermint.query('GetAsNodesByServiceId', {
      service_id,
      node_id_list,
    });
    return result != null ? (result.node != null ? result.node : []) : [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get AS nodes by service ID from blockchain',
      cause: error,
    });
  }
}

export async function getAsNodesInfoByServiceId({ service_id, node_id_list }) {
  try {
    const result = await tendermint.query('GetAsNodesInfoByServiceId', {
      service_id,
      node_id_list,
    });
    return result != null ? (result.node != null ? result.node : []) : [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get AS nodes by service ID from blockchain',
      cause: error,
    });
  }
}

export async function getServicesByAsID({ as_id }) {
  try {
    const result = await tendermint.query('GetServicesByAsID', {
      as_id,
    });
    return result != null
      ? result.services != null
        ? result.services
        : []
      : [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get services by AS ID from blockchain',
      cause: error,
    });
  }
}

export async function getAccessorGroupId(accessor_id) {
  try {
    const result = await tendermint.query('GetAccessorGroupID', {
      accessor_id,
    });
    if (result == null) {
      return null;
    }
    return result.accessor_group_id;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get accessor group ID from blockchain',
      cause: error,
    });
  }
}

export async function getAccessorKey(accessor_id) {
  try {
    const accessorPubKeyObj = await tendermint.query('GetAccessorKey', {
      accessor_id,
    });
    if (accessorPubKeyObj == null || !accessorPubKeyObj.active) {
      return null;
    }
    return accessorPubKeyObj.accessor_public_key;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get accessor public key from blockchain',
      cause: error,
    });
  }
}

export async function getAccessorOwner(accessor_id) {
  try {
    const owner = await tendermint.query('GetAccessorOwner', {
      accessor_id,
    });
    if (owner == null) {
      return null;
    }
    return owner.node_id;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get owner of accessor from blockchain',
      cause: error,
    });
  }
}

export async function checkExistingIdentity({
  reference_group_code,
  namespace,
  identifier,
}) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  if (!reference_group_code && (!namespace || !identifier)) {
    throw new Error('Missing args');
  }
  try {
    const result = await tendermint.query('CheckExistingIdentity', {
      reference_group_code,
      identity_namespace: namespace,
      identity_identifier_hash: identifier ? utils.hash(identifier) : undefined,
    });
    if (result == null) {
      return null;
    }
    return result.exist;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot check existing identity from blockchain',
      cause: error,
    });
  }
}

export async function getIdentityInfo({
  reference_group_code,
  namespace,
  identifier,
  node_id,
}) {
  if (reference_group_code && (namespace || identifier)) {
    throw new Error(
      'Cannot have both "reference_group_code" and "namespace"+"identifier" in args'
    );
  }
  if (!reference_group_code && (!namespace || !identifier)) {
    throw new Error('Missing args');
  }
  try {
    return await tendermint.query('GetIdentityInfo', {
      reference_group_code,
      identity_namespace: namespace,
      identity_identifier_hash: identifier ? utils.hash(identifier) : undefined,
      node_id,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get identity info from blockchain',
      cause: error,
    });
  }
}

export async function getReferenceGroupCode(namespace, identifier) {
  try {
    const result = await tendermint.query('GetReferenceGroupCode', {
      identity_namespace: namespace,
      identity_identifier_hash: utils.hash(identifier),
    });
    if (result == null) {
      return null;
    }
    return result.reference_group_code;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get reference group code from blockchain',
      cause: error,
    });
  }
}

export async function getReferenceGroupCodeByAccessorId(accessor_id) {
  try {
    const result = await tendermint.query('GetReferenceGroupCodeByAccessorID', {
      accessor_id,
    });
    if (result == null) {
      return null;
    }
    return result.reference_group_code;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get reference group code by accessor ID from blockchain',
      cause: error,
    });
  }
}

export async function getDataSignature({ node_id, request_id, service_id }) {
  try {
    const result = await tendermint.query('GetDataSignature', {
      node_id,
      request_id,
      service_id,
    });
    if (result == null) {
      return null;
    }
    return result.signature;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get data signature from blockchain',
      cause: error,
      node_id,
      request_id,
      service_id,
    });
  }
}

export async function getServiceDetail(service_id) {
  try {
    return await tendermint.query('GetServiceDetail', {
      service_id,
      node_id: config.nodeId,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get service details from blockchain',
      cause: error,
    });
  }
}

export async function getNamespaceList() {
  try {
    return (await tendermint.query('GetNamespaceList')) || [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get namespace list from blockchain',
      cause: error,
    });
  }
}

export async function getServiceList() {
  try {
    return (await tendermint.query('GetServiceList')) || [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get service list from blockchain',
      cause: error,
    });
  }
}

export async function getNodeInfo(node_id) {
  try {
    return await tendermint.query('GetNodeInfo', {
      node_id,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node info from blockchain',
      cause: error,
    });
  }
}

export async function checkExistingAccessorID(accessor_id) {
  try {
    const result = await tendermint.query('CheckExistingAccessorID', {
      accessor_id,
    });
    if (result == null) {
      return null;
    }
    return result.exist;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot check existing accessor ID from blockchain',
      cause: error,
    });
  }
}

export async function checkExistingAccessorGroupID(accessor_group_id) {
  try {
    const result = await tendermint.query('CheckExistingAccessorGroupID', {
      accessor_group_id,
    });
    if (result == null) {
      return null;
    }
    return result.exist;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot check existing accessor group ID from blockchain',
      cause: error,
    });
  }
}

export async function getNodesBehindProxyNode(proxy_node_id) {
  try {
    const result = await tendermint.query('GetNodesBehindProxyNode', {
      proxy_node_id,
    });
    return result != null ? (result.nodes != null ? result.nodes : []) : [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get nodes behind proxy node from blockchain',
      cause: error,
    });
  }
}

export async function isInitEnded() {
  try {
    return await tendermint.query('IsInitEnded');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot check is init ended',
      cause: error,
    });
  }
}

//
// NDID only
//

export async function addNodeToProxyNode(
  { node_id, proxy_node_id, config: nodeProxyConfig },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    await tendermint.transact({
      nodeId,
      fnName: 'AddNodeToProxyNode',
      params: { node_id, proxy_node_id, config: nodeProxyConfig },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot add node to proxy node',
      cause: error,
    });
  }
}

export async function updateNodeProxyNode(
  { node_id, proxy_node_id, config: nodeProxyConfig },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    await tendermint.transact({
      nodeId,
      fnName: 'UpdateNodeProxyNode',
      params: { node_id, proxy_node_id, config: nodeProxyConfig },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: "Cannot update node's proxy node",
      cause: error,
    });
  }
}

export async function removeNodeFromProxyNode(
  { node_id },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    await tendermint.transact({
      nodeId,
      fnName: 'RemoveNodeFromProxyNode',
      params: { node_id },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot remove node from proxy node',
      cause: error,
    });
  }
}

export async function getAllowedMinIalForRegisterIdentityAtFirstIdp() {
  try {
    const result = await tendermint.query(
      'GetAllowedMinIalForRegisterIdentityAtFirstIdp'
    );
    return result != null
      ? result.min_ial != null
        ? result.min_ial
        : null
      : null;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get allowed min IAL for registerIdentity at first IdP',
      cause: error,
    });
  }
}

export async function setAllowedMinIalForRegisterIdentityAtFirstIdp(
  { min_ial },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  try {
    await tendermint.transact({
      nodeId,
      fnName: 'SetAllowedMinIalForRegisterIdentityAtFirstIdp',
      params: { min_ial },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot set allowed min IAL for registerIdentity at first IdP',
      cause: error,
    });
  }
}
