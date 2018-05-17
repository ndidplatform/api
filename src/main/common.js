import * as tendermint from '../tendermint/ndid';
import TendermintWsClient from '../tendermint/wsClient';
import * as rp from './rp';
import * as idp from './idp';
import * as as from './as';
import * as utils from '../utils';
import { role, nodeId } from '../config';

export let latestBlockHeight = null;

let handleTendermintNewBlockHeaderEvent;
if (role === 'rp') {
  handleTendermintNewBlockHeaderEvent = rp.handleTendermintNewBlockHeaderEvent;
} else if (role === 'idp') {
  handleTendermintNewBlockHeaderEvent = idp.handleTendermintNewBlockHeaderEvent;
} else if (role === 'as') {
  handleTendermintNewBlockHeaderEvent = as.handleTendermintNewBlockHeaderEvent;
}

const tendermintWsClient = new TendermintWsClient();

tendermintWsClient.on('connected', () => {
  // tendermintWsClient.getStatus();
});

tendermintWsClient.on('newBlockHeader#event', (error, result) => {
  const blockHeight = result.data.data.header.height;
  if (latestBlockHeight == null || latestBlockHeight < blockHeight) {
    const lastKnownBlockHeight = latestBlockHeight;
    latestBlockHeight = blockHeight;

    const missingBlockCount =
      lastKnownBlockHeight == null
        ? null
        : blockHeight - lastKnownBlockHeight - 1;
    if (handleTendermintNewBlockHeaderEvent) {
      handleTendermintNewBlockHeaderEvent(error, result, missingBlockCount);
    }
  }
});

export function getBlocks(fromHeight, toHeight) {
  return tendermintWsClient.getBlocks(fromHeight, toHeight);
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
}) {
  return await tendermint.query('GetMsqDestination', {
    hash_id: utils.hash(namespace + ':' + identifier),
    min_ial: min_ial,
  });
}

/*export async function getRequestRequireHeight(data, requireHeight) {
  let currentHeight,request;
  do {
    let [ _request, _currentHeight ] = await utils.queryChain('GetRequest', data, true);
    currentHeight = _currentHeight;
    request = _request;
    //sleep
    await new Promise(resolve => { setTimeout(resolve,1000); });
  }
  while(currentHeight < requireHeight + 2); //magic number...
  return request;
}*/

/*
  data = { node_id, public_key }
*/
export async function addNodePubKey(data) {
  let result = await tendermint.transact(
    'AddNodePublicKey',
    data,
    utils.getNonce()
  );
  return result;
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

  const valid =
    msgBlockchain.messageHash === utils.hash(request.request_message);
  if (!valid) {
    console.error(
      'Mq and blockchain not matched!!',
      request.request_message,
      msgBlockchain.messageHash
    );
  }

  return valid;
}
