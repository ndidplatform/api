import fs from 'fs';
import fetch from 'node-fetch';
import * as common from '../main/common';
import * as utils from './utils';
import { eventEmitter } from '../mq';
import * as config from '../config';

const privKey = 'IDP_PrivateKey';
let msqQueue = {};
let blockchainQueue = {};

let callbackUrl = null;

export const setCallbackUrl = (url) => {
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
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ request }),
  });
}

async function checkIntegrity(requestId) {
  //check hash, if hash match then pass to app layer
  if (msqQueue[requestId] && blockchainQueue[requestId]) {
    let msgBlockchain = blockchainQueue[requestId];
    let message = msqQueue[requestId];

    if (
      msgBlockchain.messageHash === (await utils.hash(message.request_message))
    ) {
      notifyByCallback(message);
    } else {
      console.error(
        'Msq and blockchain not matched!!',
        message.request_message,
        msgBlockchain.messageHash
      );
    }

    delete blockchainQueue[requestId];
    delete msqQueue[requestId];
  }
}

export async function registerMsqDestination(data) {
  let result = await utils.updateChain(
    'RegisterMsqDestination',
    data,
    utils.getNonce()
  );
  return result;
}

export async function addNodePubKey(data) {
  let result = await utils.updateChain(
    'AddNodePublicKey',
    data,
    utils.getNonce()
  );
  return result;
}

export async function handleMessageFromQueue(request) {
  console.log('IDP receive message from msq:', request);
  let requestJson = JSON.parse(request);
  msqQueue[requestJson.request_id] = requestJson;
  checkIntegrity(requestJson.request_id);
}

export async function handleNodeLogicCallback(requestId) {
  console.log('Callback (event) from node logic; requestId:', requestId);
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
      ial: elem.ial,
    });
  }
  let node_id = config.msqRegister.ip + ':' + config.msqRegister.port;

  //register node id, which is substituted with ip,port for demo
  registerMsqDestination({
    users,
    node_id,
  });

  addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key',
  });

  eventEmitter.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
