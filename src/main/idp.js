import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

import * as common from '../main/common';
import * as utils from './utils';
import * as config from '../config';

import { eventEmitter } from '../mq';

const privKey = 'IDP_PrivateKey';
let mqReceivingQueue = {};
let blockchainQueue = {};

let callbackUrl = null;
try {
  callbackUrl = fs.readFileSync(path.join(__dirname, '../../idp-callback-url.json'), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.log(error);
  }
}

export const setCallbackUrl = url => {
  callbackUrl = url;
  fs.writeFile(path.join(__dirname, '../../idp-callback-url.json'), url, (err) => {
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
    accessor_id
  } = data;

  let dataToBlockchain = {
    request_id,
    aal,
    ial,
    status,
    signature,
    accessor_id,
    identity_proof: utils.generateIdentityProof(data)
  };
  let result = await utils.updateChain(
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
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ request })
  });
}

async function checkIntegrity(requestId) {
  //check hash, if hash match then pass to app layer
  if (mqReceivingQueue[requestId] && blockchainQueue[requestId]) {
    let msgBlockchain = blockchainQueue[requestId];
    let message = mqReceivingQueue[requestId];

    if (
      msgBlockchain.messageHash === (await utils.hash(message.request_message))
    ) {
      notifyByCallback(message);
    } else {
      console.error(
        'Mq and blockchain not matched!!',
        message.request_message,
        msgBlockchain.messageHash
      );
    }

    delete blockchainQueue[requestId];
    delete mqReceivingQueue[requestId];
  }
}

async function handleMessageFromQueue(request) {
  console.log('IDP receive message from mq:', request);
  let requestJson = JSON.parse(request);
  mqReceivingQueue[requestJson.request_id] = requestJson;
  checkIntegrity(requestJson.request_id);
}

export async function handleABCIAppCallback(requestId, height) {
  console.log('Callback (event) from ABCI app; requestId:', requestId);
  blockchainQueue[requestId] = await common.getRequestRequireHeight({ requestId }, height);
  checkIntegrity(requestId);
}

//===================== Initialize before flow can start =======================

export async function init() {
  //TODO
  //In production this should be done only once in phase 1,
  //when IDP request to join approved NDID
  //after first approved, IDP can add other key and node and endorse themself
  let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
  common.addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key'
  });
}

if (config.role === 'idp') {
  eventEmitter.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
