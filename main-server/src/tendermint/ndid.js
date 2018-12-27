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
import client from '../master-worker-interface/client';

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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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

export async function registerAccessor(
  { accessor_type, accessor_public_key, accessor_id, accessor_group_id },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'RegisterAccessor',
      params: {
        accessor_type,
        accessor_public_key,
        accessor_id,
        accessor_group_id,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register accessor to blockchain',
      cause: error,
    });
  }
}

export async function clearRegisterIdentityTimeout(
  hash_id,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    const result = await tendermint.transact({
      nodeId,
      fnName: 'ClearRegisterIdentityTimeout',
      params: { hash_id },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot mark register identity as success to blockchain',
      cause: error,
    });
  }
}

export async function registerIdentity(
  { users },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    const result = await tendermint.transact({
      nodeId,
      fnName: 'RegisterIdentity',
      params: {
        users,
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

export async function addAccessorMethod(
  {
    request_id,
    accessor_group_id,
    accessor_type,
    accessor_id,
    accessor_public_key,
  },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'AddAccessorMethod',
      params: {
        request_id,
        accessor_group_id,
        accessor_type,
        accessor_id,
        accessor_public_key,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot add accessor method to blockchain',
      cause: error,
    });
  }
}

export async function revokeAccessorMethod(
  { request_id, accessor_id },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'RevokeAccessorMethod',
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
      message: 'Cannot revoke accessor method from blockchain',
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  { hash_id, ial },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    await tendermint.transact({
      nodeId,
      fnName: 'UpdateIdentity',
      params: {
        hash_id,
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
      hash_id,
      ial,
    });
  }
}

export async function declareIdentityProof(
  { request_id, identity_proof },
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    return await tendermint.transact({
      nodeId,
      fnName: 'DeclareIdentityProof',
      params: {
        request_id,
        identity_proof,
        idp_id: nodeId,
      },
      callbackFnName,
      callbackAdditionalArgs,
      saveForRetryOnChainDisabled,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot declare identity proof to blockchain',
      cause: error,
    });
  }
}

export async function createIdpResponse(
  responseDataToBlockchain,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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

export async function registerServiceDestination(
  params,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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

export async function updateServiceDestination(
  params,
  nodeId,
  callbackFnName,
  callbackAdditionalArgs,
  saveForRetryOnChainDisabled
) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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

export async function getChainHistory() {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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

export async function getIdpNodes({ namespace, identifier, min_ial, min_aal }) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    const result = await tendermint.query('GetIdpNodes', {
      hash_id:
        namespace && identifier
          ? utils.hash(namespace + ':' + identifier)
          : undefined,
      min_ial,
      min_aal,
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
  namespace,
  identifier,
  min_ial,
  min_aal,
  node_id_list,
}) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    const result = await tendermint.query('GetIdpNodesInfo', {
      hash_id:
        namespace && identifier
          ? utils.hash(namespace + ':' + identifier)
          : undefined,
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

export async function getAsNodesByServiceId({ service_id }) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    const result = await tendermint.query('GetAsNodesByServiceId', {
      service_id,
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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

export async function checkExistingIdentity(hash_id) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    const result = await tendermint.query('CheckExistingIdentity', {
      hash_id,
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

export async function getIdentityInfo(namespace, identifier, node_id) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    const sid = namespace + ':' + identifier;
    const hash_id = utils.hash(sid);

    return await tendermint.query('GetIdentityInfo', {
      hash_id,
      node_id,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get identity info from blockchain',
      cause: error,
    });
  }
}

export async function getIdentityProof(request_id, idp_id) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
  try {
    const result = await tendermint.query('GetIdentityProof', {
      request_id,
      idp_id,
    });
    if (result == null) {
      return null;
    }
    return result.identity_proof;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get identity proof from blockchain',
      cause: error,
    });
  }
}

export async function getDataSignature({ node_id, request_id, service_id }) {
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
  if(!config.isMaster) {
    client.tendermint({
      fnName: arguments.callee.name,
      args: arguments
    });
    return;
  }
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
