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

import CustomError from '../error/custom_error';

const nodeId = config.nodeId;

//
// Transact
//

/**
 *
 * @param {Object} data
 * @param {string} data.node_id
 * @param {string} data.public_key
 */
export async function addNodePubKey(
  data,
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    const result = await tendermint.transact(
      'AddNodePublicKey',
      data,
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot add node public key to blockchain',
      cause: error,
    });
  }
}

export async function registerMsqAddress(
  { ip, port },
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    return await tendermint.transact(
      'RegisterMsqAddress',
      {
        ip,
        port,
        node_id: nodeId,
      },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register message queue address to blockchain',
      cause: error,
    });
  }
}

export async function updateNode(
  { public_key, master_public_key },
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    const { success } = await tendermint.transact(
      'UpdateNode',
      {
        public_key,
        master_public_key,
      },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs,
      true
    );
    return success;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot update node keys to blockchain',
      cause: error,
    });
  }
}

export async function createIdentity(
  { accessor_type, accessor_public_key, accessor_id, accessor_group_id },
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    return await tendermint.transact(
      'CreateIdentity',
      {
        accessor_type,
        accessor_public_key,
        accessor_id,
        accessor_group_id,
      },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot create identity to blockchain',
      cause: error,
    });
  }
}

export async function clearRegisterMsqDestinationTimeout(
  hash_id,
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    const result = await tendermint.transact(
      'ClearRegisterMsqDestinationTimeout',
      { hash_id },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot mark message queue destination as success to blockchain',
      cause: error,
    });
  }
}

export async function registerMqDestination(
  { users },
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    const result = await tendermint.transact(
      'RegisterMsqDestination',
      {
        users,
      },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register message queue destination to blockchain',
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
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    return await tendermint.transact(
      'AddAccessorMethod',
      {
        request_id,
        accessor_group_id,
        accessor_type,
        accessor_id,
        accessor_public_key,
      },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot add accessor method to blockchain',
      cause: error,
    });
  }
}

export async function createRequest(
  requestDataToBlockchain,
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    return await tendermint.transact(
      'CreateRequest',
      requestDataToBlockchain,
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot create request to blockchain',
      cause: error,
    });
  }
}

export async function closeRequest(
  { requestId, responseValidList },
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    const result = await tendermint.transact(
      'CloseRequest',
      { request_id: requestId, response_valid_list: responseValidList },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
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
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    const request = await getRequest({ requestId });
    if (request.closed === false) {
      await tendermint.transact(
        'TimeOutRequest',
        { request_id: requestId, response_valid_list: responseValidList },
        utils.getNonce(),
        callbackFnName,
        callbackAdditionalArgs
      );
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
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    const result = await tendermint.transact(
      'SetDataReceived',
      {
        request_id: requestId,
        service_id,
        as_id,
      },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
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
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    await tendermint.transact(
      'UpdateIdentity',
      {
        hash_id,
        ial,
      },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
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
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    return await tendermint.transact(
      'DeclareIdentityProof',
      {
        request_id,
        identity_proof,
        idp_id: nodeId,
      },
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot declare identity proof to blockchain',
      cause: error,
    });
  }
}

export async function createIdpResponse(
  responseDataToBlockchain,
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    return await tendermint.transact(
      'CreateIdpResponse',
      responseDataToBlockchain,
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot create IdP response to blockchain',
      cause: error,
    });
  }
}

export async function signASData(data, callbackFnName, callbackAdditionalArgs) {
  const dataToBlockchain = {
    request_id: data.request_id,
    signature: data.signature,
    service_id: data.service_id,
  };
  try {
    return await tendermint.transact(
      'SignData',
      dataToBlockchain,
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot sign AS data',
      cause: error,
    });
  }
}

export async function registerServiceDestination(
  data,
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    await tendermint.transact(
      'RegisterServiceDestination',
      data,
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register service destination',
      cause: error,
    });
  }
}

export async function updateServiceDestination(
  data,
  callbackFnName,
  callbackAdditionalArgs
) {
  try {
    await tendermint.transact(
      'UpdateServiceDestination',
      data,
      utils.getNonce(),
      callbackFnName,
      callbackAdditionalArgs
    );
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

export async function getMsqAddress(node_id) {
  try {
    return await tendermint.query('GetMsqAddress', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get message queue address from blockchain',
      cause: error,
    });
  }
}

export async function getNodeToken(node_id = nodeId) {
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

export async function getIdpNodes({ namespace, identifier, min_ial, min_aal }) {
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
    if (accessorPubKeyObj == null) {
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

export async function checkExistingIdentity(hash_id) {
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

//
// NDID only
//
