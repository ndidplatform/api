import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

import * as tendermint from '../tendermint/ndid';
import * as common from '../main/common';
import * as utils from '../utils';
import * as config from '../config';
import * as db from '../db';

import { eventEmitter } from '../mq';

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
    console.log(error);
  }
}

export const setCallbackUrl = (url) => {
  callbackUrl = url;
  fs.writeFile(callbackUrlFilePath, url, (err) => {
    if (err) {
      console.error('Error writing IDP callback url file');
    }
  });
};

export const getCallbackUrl = () => {
  return callbackUrl;
};

export async function createIdpResponse(data) {
  let {
    request_id,
    namespace,
    identifier,
    aal,
    ial,
    status,
    signature,
    accessor_id,
  } = data;

  let dataToBlockchain = {
    request_id,
    aal,
    ial,
    status,
    signature,
    accessor_id,
    identity_proof: utils.generateIdentityProof(data),
  };
  let result = await tendermint.transact(
    'CreateIdpResponse',
    dataToBlockchain,
    utils.getNonce()
  );
  return result;
}

async function notifyByCallback(request) {
  if (!callbackUrl) {
    console.error('callbackUrl for IDP not set');
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

async function handleMessageFromQueue(request) {
  console.log('IDP receive message from mq:', request);
  let requestJson = JSON.parse(request);

  if (common.latestBlockHeight < requestJson.height) {
    await db.setRequestReceivedFromMQ(requestJson.request_id, requestJson);
    await db.addRequestIdExpectedInBlock(
      requestJson.height,
      requestJson.request_id
    );
    return;
  }

  const valid = await common.checkRequestIntegrity(requestJson.request_id, requestJson);
  if (valid) {
    notifyByCallback(requestJson);
  }
}

export async function handleTendermintNewBlockEvent(
  error,
  result,
  missingBlockCount
) {
  // messages that arrived before 'NewBlock' event
  // including messages between (latestBlockHeight - missingBlockCount) and latestBlockHeight
  // (not only just current height in case 'NewBlock' events are missing)
  const fromHeight = common.latestBlockHeight - missingBlockCount;
  const toHeight = common.latestBlockHeight;

  const requestIdsInTendermintBlock = await db.getRequestIdsExpectedInBlock(
    fromHeight,
    toHeight
  );
  requestIdsInTendermintBlock.forEach(async function(requestId) {
    const message = await db.getRequestReceivedFromMQ(requestId);
    const valid = await common.checkRequestIntegrity(requestId, message);
    if (valid) {
      notifyByCallback(message);
    }
    db.removeRequestReceivedFromMQ(requestId);
  });

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

if (config.role === 'idp') {
  eventEmitter.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
