import CustomError from '../error/customError';
import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as rp from './rp';
import * as idp from './idp';
import * as as from './as';
import { eventEmitter as messageQueueEvent } from '../mq';
import * as utils from '../utils';
import { role, nodeId } from '../config';

let handleMessageFromQueue;
if (role === 'rp') {
  handleMessageFromQueue = rp.handleMessageFromQueue;
  tendermint.setTendermintNewBlockHeaderEventHandler(
    rp.handleTendermintNewBlockHeaderEvent
  );
} else if (role === 'idp') {
  handleMessageFromQueue = idp.handleMessageFromQueue;
  tendermint.setTendermintNewBlockHeaderEventHandler(
    idp.handleTendermintNewBlockHeaderEvent
  );
} else if (role === 'as') {
  handleMessageFromQueue = as.handleMessageFromQueue;
  tendermint.setTendermintNewBlockHeaderEventHandler(
    as.handleTendermintNewBlockHeaderEvent
  );
}

export async function getRequest({ requestId }) {
  try {
    return await tendermint.query('GetRequest', { requestId });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get request from blockchain',
      cause: error,
    });
  }
}

export async function getRequestDetail({ requestId }) {
  try {
    return await tendermint.query('GetRequestDetail', { requestId });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get request details from blockchain',
      cause: error,
    });
  }
}

export async function getNodeIdsOfAssociatedIdp({
  namespace,
  identifier,
  min_ial,
  min_aal,
}) {
  try {
    return await tendermint.query('GetMsqDestination', {
      hash_id:
        namespace && identifier
          ? utils.hash(namespace + ':' + identifier)
          : undefined,
      min_ial,
      min_aal,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get associated node IDs from blockchain',
      cause: error,
    });
  }
}

export async function getNodeIdsOfAsWithService({ service_id }) {
  try {
    return await tendermint.query('GetServiceDestination', {
      service_id,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get associated AS node IDs from blockchain',
      cause: error,
    });
  }
}

/**
 *
 * @param {Object} data
 * @param {string} data.node_id
 * @param {string} data.public_key
 */
export async function addNodePubKey(data) {
  try {
    const result = await tendermint.transact(
      'AddNodePublicKey',
      data,
      utils.getNonce()
    );
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot add node public key to blockchain',
      cause: error,
    });
  }
}

export async function getNodePubKey(node_id) {
  try {
    return await tendermint.query('GetNodePublicKey', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node public key from blockchain',
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

export async function registerMsqAddress({ ip, port }) {
  try {
    return await tendermint.transact(
      'RegisterMsqAddress',
      {
        ip,
        port,
        node_id: nodeId,
      },
      utils.getNonce()
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register message queue address to blockchain',
      cause: error,
    });
  }
}

export async function getNodeToken(node_id = nodeId) {
  try {
    return await tendermint.query('GetNodeToken', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node token from blockchain',
      cause: error,
    });
  }
}

export async function checkRequestIntegrity(requestId, request) {
  const msgBlockchain = await getRequest({ requestId });

  const valid = 
    utils.hash(request.challenge + request.request_message)
    === msgBlockchain.messageHash;
  /*utils.compareSaltedHash({
    saltedHash: msgBlockchain.messageHash,
    plain: request.request_message,
  });*/
  if (!valid) {
    logger.warn({
      message: 'Request message hash mismatched',
      requestId,
    });
    logger.debug({
      message: 'Request message hash mismatched',
      requestId,
      givenRequestMessage: request.request_message,
      givenRequestMessageHash: utils.hash(request.request_message),
      requestMessageHashFromBlockchain: msgBlockchain.messageHash,
    });
  }

  return valid;
}

export async function getNamespaceList() {
  try {
    return await tendermint.query('GetNamespaceList');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get namespace list from blockchain',
      cause: error,
    });
  }
}

if (handleMessageFromQueue) {
  messageQueueEvent.on('message', handleMessageFromQueue);
}

export function verifyZKProof(request_id, idp_id) {
  const { privateProof, challenge } from persistentDB;

  //query and verify zk, also check conflict with each others
  //query accessor_group_id of this accessor_id
  //and check against all accessor_group_id of responses

  //query accessor_public_key from privateProof.accessor_id
  let public_key = '...' + privateProof.accessor_id;
  //query publicProof from response of idp_id in request
  let publicProof = '...' + request_id + idp_id;

  return utils.verifyZKProof(public_key, challenge, privateProof, publicProof);
}

