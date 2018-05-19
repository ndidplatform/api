import path from 'path';
import fs from 'fs';

import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import TendermintWsClient from '../tendermint/wsClient';
import * as rp from './rp';
import * as idp from './idp';
import * as as from './as';
import { eventEmitter as messageQueueEvent } from '../mq';
import * as utils from '../utils';
import { role, nodeId } from '../config';

let handleMessageFromQueue;
if (role === 'rp') {
  handleMessageFromQueue = rp.handleMessageFromQueue;
} else if (role === 'idp') {
  handleMessageFromQueue = idp.handleMessageFromQueue;
} else if (role === 'as') {
  handleMessageFromQueue = as.handleMessageFromQueue;
}

let handleTendermintNewBlockHeaderEvent;
if (role === 'rp') {
  handleTendermintNewBlockHeaderEvent = rp.handleTendermintNewBlockHeaderEvent;
} else if (role === 'idp') {
  handleTendermintNewBlockHeaderEvent = idp.handleTendermintNewBlockHeaderEvent;
} else if (role === 'as') {
  handleTendermintNewBlockHeaderEvent = as.handleTendermintNewBlockHeaderEvent;
}

export let latestBlockHeight = null;
const latestBlockHeightFilepath = path.join(
  __dirname,
  '..',
  '..',
  `latest-block-height-${nodeId}`
);
try {
  latestBlockHeight = fs.readFileSync(latestBlockHeightFilepath, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') {
    logger.warn({
      message: 'Latest block height file not found',
      error,
    });
  } else {
    logger.error({
      message: 'Cannot read latest block height file',
      error,
    });
  }
}

/**
 * Save last seen block height to file for loading it on server restart
 * @param {number} height Block height to save
 */
function saveLatestBlockHeight(height) {
  fs.writeFile(latestBlockHeightFilepath, height, (err) => {
    if (err) {
      logger.error({
        message: 'Cannot write latest block height file',
        error: err,
      });
    }
  });
}

export const tendermintWsClient = new TendermintWsClient();

tendermintWsClient.on('connected', () => {
  // tendermintWsClient.getStatus();
});

tendermintWsClient.on('newBlockHeader#event', async (error, result) => {
  const blockHeight = result.data.data.header.height;
  if (latestBlockHeight == null || latestBlockHeight < blockHeight) {
    const lastKnownBlockHeight = latestBlockHeight;
    latestBlockHeight = blockHeight;

    const missingBlockCount =
      lastKnownBlockHeight == null
        ? null
        : blockHeight - lastKnownBlockHeight - 1;
    if (handleTendermintNewBlockHeaderEvent) {
      await handleTendermintNewBlockHeaderEvent(
        error,
        result,
        missingBlockCount
      );
    }
    saveLatestBlockHeight(blockHeight);
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

export async function getNodeIdsOfAsWithService({ service_id }) {
  return await tendermint.query('GetServiceDestination', {
    service_id,
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

  const valid = utils.compareSaltedHash({
    saltedHash: msgBlockchain.messageHash,
    plain: request.request_message,
  });
    //msgBlockchain.messageHash === utils.hash(request.request_message);
  // if (!valid) {
  //   console.error(
  //     'Mq and blockchain not matched!!',
  //     request.request_message,
  //     msgBlockchain.messageHash
  //   );
  // }

  return valid;
}

if (handleMessageFromQueue) {
  messageQueueEvent.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
