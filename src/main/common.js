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

/*
  data = { requestId }
*/
export async function getRequest({ requestId }) {
  return await tendermint.query('GetRequest', { requestId });
}

export async function getRequestDetail({ requestId }) {
  return await tendermint.query('GetRequestDetail', { requestId });
}

export async function getNodeIdsOfAssociatedIdp({
  namespace,
  identifier,
  min_ial,
  min_aal,
}) {
  return await tendermint.query('GetMsqDestination', {
    hash_id: (namespace && identifier)
     ? utils.hash(namespace + ':' + identifier)
     : undefined,
    min_ial,
    min_aal,
  });
}

export async function getNodeIdsOfAsWithService({ service_id }) {
  return await tendermint.query('GetServiceDestination', {
    service_id,
  });
}

/*
  data = { node_id, public_key }
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
    // TODO:
    throw error;
  }
}

/*
  node_id
*/
export async function getNodePubKey(node_id) {
  return await tendermint.query('GetNodePublicKey', { node_id });
}

export async function getMsqAddress(node_id) {
  return await tendermint.query('GetMsqAddress', { node_id });
}

export async function registerMsqAddress({ ip, port }) {
  return await tendermint.transact(
    'RegisterMsqAddress',
    {
      ip,
      port,
      node_id: nodeId,
    },
    utils.getNonce()
  );
}

export async function getNodeToken(node_id = nodeId) {
  return await tendermint.query('GetNodeToken', { node_id });
}

export async function checkRequestIntegrity(requestId, request) {
  const msgBlockchain = await getRequest({ requestId });

  const valid = utils.compareSaltedHash({
    saltedHash: msgBlockchain.messageHash,
    plain: request.request_message,
  });
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
  return await tendermint.query('GetNamespaceList');
}

if (handleMessageFromQueue) {
  messageQueueEvent.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
