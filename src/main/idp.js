import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as common from './common';
import * as identity from './identity';
import * as utils from '../utils';
import * as config from '../config';
import * as db from '../db';

const callbackUrlFilePath = path.join(
  __dirname,
  '..',
  '..',
  'idp-callback-url'
);
let callbackUrl = null;
try {
  callbackUrl = fs.readFileSync(callbackUrlFilePath, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') {
    logger.warn({
      message: 'IDP callback url file not found',
      error,
    });
  } else {
    logger.error({
      message: 'Cannot read IDP callback url file',
      error,
    });
  }
}

export const setCallbackUrl = (url) => {
  callbackUrl = url;
  fs.writeFile(callbackUrlFilePath, url, (err) => {
    if (err) {
      logger.error({
        message: 'Cannot write IDP callback url file',
        error: err,
      });
    }
  });
};

export const getCallbackUrl = () => {
  return callbackUrl;
};

export async function createIdpResponse(data) {
  let {
    request_id,
    aal,
    status,
    signature,
  } = data;

  let dataToBlockchain = {
    request_id,
    aal,
    status,
    signature,
    identity_proof: utils.generateIdentityProof(data),
  };
  let [result, height] = await tendermint.transact(
    'CreateIdpResponse',
    dataToBlockchain,
    utils.getNonce()
  );
  return result;
}

async function notifyByCallback(request) {
  if (!callbackUrl) {
    logger.error({
      message: 'Callback URL for IDP has not been set'
    });
    return;
  }
  fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ request }),
  });
}

export async function handleMessageFromQueue(request) {
  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    request,
  });
  const requestJson = JSON.parse(request);

  if (common.latestBlockHeight < requestJson.height) {
    await db.setRequestReceivedFromMQ(requestJson.request_id, requestJson);
    await db.addRequestIdExpectedInBlock(
      requestJson.height,
      requestJson.request_id
    );
    return;
  }

  const valid = await common.checkRequestIntegrity(
    requestJson.request_id,
    requestJson
  );
  if (valid) {
    notifyByCallback({
      request_message_hash: utils.hash(requestJson.request_message),
      ...requestJson,
    });
  }
}

export async function handleTendermintNewBlockHeaderEvent(
  error,
  result,
  missingBlockCount
) {
  const height = tendermint.getBlockHeightFromNewBlockHeaderEvent(result);
  // messages that arrived before 'NewBlock' event
  // including messages between the start of missing block's height
  // and the block before latest block height
  // (not only just (current height - 1) in case 'NewBlock' events are missing)
  // NOTE: tendermint always create a pair of block. A block with transactions and
  // a block that signs the previous block which indicates that the previous block is valid
  const fromHeight =
    missingBlockCount == null
      ? 1
      : missingBlockCount === 0
        ? height - 1
        : height - missingBlockCount;
  const toHeight = height - 1;

  //TODO
  //MUST check if this is specialRequest
  if(this is special request) {
    identity.addAccessorMethod(specialRequestId);
    return ??
  }

  const requestIdsInTendermintBlock = await db.getRequestIdsExpectedInBlock(
    fromHeight,
    toHeight
  );
  await Promise.all(
    requestIdsInTendermintBlock.map(async (requestId) => {
      const message = await db.getRequestReceivedFromMQ(requestId);
      const valid = await common.checkRequestIntegrity(requestId, message);
      if (valid) {
        notifyByCallback({
          request_message_hash: utils.hash(message.request_message),
          ...message,
        });
      }
      db.removeRequestReceivedFromMQ(requestId);
    })
  );

  db.removeRequestIdsExpectedInBlock(fromHeight, toHeight);
}

/*export async function handleNewBlockEvent(data) {
  let height = -1; //derive from data;
  let requestId = -1; //derive from data;
  blockHeight = height;
  for(let tx in data.txs) {
    blockchainQueue[requestId] = data.txs.request.body; //derive from data
    //msq may not arrive yet, or else, this tx do not concern this idp
    //TODO: should have mechanism to clear blockchainQueue that do not concern this idp
    if(!mqReceivingQueue[requestId]) continue; 
    checkIntegrity(tx.request_id).then((valid) => {
      if(valid) notifyByCallback(mqReceivingQueue[requestId]);
    });
  }
}*/

//===================== Initialize before flow can start =======================

export async function init() {
  //TODO
  //In production this should be done only once in phase 1,
  //when IDP request to join approved NDID
  //after first approved, IDP can add other key and node and endorse themself
  /*let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
  process.env.nodeId = node_id;
  common.addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key_for_idp'
  });*/
  common.registerMsqAddress(config.mqRegister);
}
