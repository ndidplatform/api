import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

import * as tendermint from '../tendermint/ndid';
import * as mq from '../mq';
import * as utils from '../utils';
import * as config from '../config';
import * as common from '../main/common';
import * as db from '../db';

const callbackUrlFilePath = path.join(__dirname, '..', '..', 'as-callback-url');
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
      console.error('Error writing AS callback url file');
    }
  });
};

export const getCallbackUrl = () => {
  return callbackUrl;
};

async function sendDataToRP(data) {
  let receivers = [];
  let nodeId = data.rp_node_id;
  let { ip, port } = await common.getMsqAddress(nodeId);
  receivers.push({
    ip,
    port,
    ...(await common.getNodePubKey(nodeId)),
  });
  mq.send(receivers, {
    as_id: data.as_id,
    data: data.data,
    request_id: data.request_id,
  });
}

async function signData(data) {
  let nonce = utils.getNonce();
  let dataToBlockchain = {
    as_id: data.as_id,
    request_id: data.request_id,
    signature: data.signature,
  };
  tendermint.transact('SignData', dataToBlockchain, nonce);
}

async function registerServiceDestination(data) {
  let nonce = utils.getNonce();
  let dataToBlockchain = {
    //as_id: data.as_id,
    service_id: data.service_id,
    node_id: data.node_id,
  };
  tendermint.transact('RegisterServiceDestination', dataToBlockchain, nonce);
}

async function notifyByCallback(request) {
  if (!callbackUrl) {
    console.error('callbackUrl for AS not set');
    return;
  }
  let data = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ request }),
  });
  let result = await data.json();
  return result.data;
}

async function getResponseDetails(requestId) {
  const requestDetail = await common.getRequestDetail({ requestId });

  // TODO
  // Verify that (number of consent ≥ min_idp in request).
  // For each consent with matching request ID:
  // Verify the identity proof.
  // Verify the signature.
  // Verify that the message_hash is matching with the request.

  // Get all signatures
  // and calculate max ial && max aal
  let signatures = [];
  let max_ial = 0;
  let max_aal = 0;
  requestDetail.responses.forEach((response) => {
    signatures.push(response.signature);
    if (response.aal > max_aal) max_aal = response.aal;
    if (response.ial > max_ial) max_ial = response.ial;
  });

  return {
    signatures,
    max_aal,
    max_ial,
  };
}

async function getDataAndSendBackToRP(requestJson, responseDetails) {
  // Then callback to AS.
  console.log('Callback to AS', {
    request_id: requestJson.request_id,
    request_params: requestJson.request_params,
    ...responseDetails,
  });

  // Platform→AS
  // The AS replies synchronously with the requested data
  let data = await notifyByCallback({
    request_id: requestJson.request_id,
    request_params: requestJson.request_params,
    ...responseDetails,
  });

  // When received data
  let as_id = config.asID;
  let signature = await utils.createSignature(data);
  // AS node encrypts the response and sends it back to RP via NSQ.
  sendDataToRP({
    rp_node_id: requestJson.rp_node_id,
    as_id,
    data,
    request_id: requestJson.request_id,
  });

  // AS node adds transaction to blockchain
  signData({ as_id, request_id: requestJson.request_id, signature });
}

export async function handleMessageFromQueue(request) {
  console.log('AS receive message from mq:', request);
  let requestJson = JSON.parse(request);

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
    const responseDetails = await getResponseDetails(requestJson.request_id);
    getDataAndSendBackToRP(requestJson, responseDetails);
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

  const requestIdsInTendermintBlock = await db.getRequestIdsExpectedInBlock(
    fromHeight,
    toHeight
  );
  await Promise.all(
    requestIdsInTendermintBlock.map(async (requestId) => {
      const message = await db.getRequestReceivedFromMQ(requestId);
      const valid = await common.checkRequestIntegrity(requestId, message);
      if (valid) {
        const responseDetails = await getResponseDetails(requestId);
        getDataAndSendBackToRP(message, responseDetails);
      }
      db.removeRequestReceivedFromMQ(requestId);
    })
  );

  db.removeRequestIdsExpectedInBlock(fromHeight, toHeight);
}

//===================== Initialize before flow can start =======================

export async function init() {
  // In production environment, this should be done with register service process.
  // TODO
  //register node id, which is substituted with ip,port for demo
  //let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
  //process.env.nodeId = node_id;
  // Hard code add back statement service for demo
  registerServiceDestination({
    //as_id: config.asID,
    service_id: 'bank_statement',
    node_id: config.nodeId,
  });
  common.registerMsqAddress(config.mqRegister);
  /*common.addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key_for_as'
  });*/
}
