import fs from 'fs';
import fetch from 'node-fetch';

import * as common from '../main/common';
import * as utils from './utils';
import * as config from '../config';

import { eventEmitter } from '../mq';

const privKey = 'IDP_PrivateKey';
let mqReceivingQueue = {};
let blockchainQueue = {};

let callbackUrl = null;

export const setCallbackUrl = url => {
  callbackUrl = url;
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

export async function registerMqDestination(data) {
  let result = await utils.updateChain(
    'RegisterMsqDestination',
    data,
    utils.getNonce()
  );
  return result;
}

async function handleMessageFromQueue(request) {
  console.log('IDP receive message from mq:', request);
  let requestJson = JSON.parse(request);
  mqReceivingQueue[requestJson.request_id] = requestJson;
  checkIntegrity(requestJson.request_id);
}

export async function handleABCIAppCallback(requestId) {
  console.log('Callback (event) from ABCI app; requestId:', requestId);
  blockchainQueue[requestId] = await common.getRequest({ requestId });
  checkIntegrity(requestId);
}

//===================== Initialize before flow can start =======================

export async function init() {
  // Users associate with this idp
  // In production environment, this should be done with onboarding process.
  // TODO
  let userList = JSON.parse(
    fs.readFileSync(process.env.ASSOC_USERS, 'utf8').toString()
  );

  let users = [];
  for (let i in userList) {
    let elem = userList[i];
    users.push({
      hash_id: await utils.hash(elem.namespace + ':' + elem.identifier),
      ial: elem.ial
    });
  }
  let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;

  //register node id, which is substituted with ip,port for demo
  registerMqDestination({
    users,
    node_id
  });

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
