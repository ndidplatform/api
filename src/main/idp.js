import * as utils from './utils';
import * as config from '../config';
import { eventEmitter, checkIntegrity } from '../msq/index';
import fetch from 'node-fetch';
import fs from 'fs';

var privKey = 'IDP_PrivateKey';

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
  }
  let result = await utils.updateChain(
    'CreateIdpResponse',dataToBlockchain,utils.getNonce()
  );
  return result;
}

export async function registerMsqDestination(data) {
  let result = await utils.updateChain('RegisterMsqDestination',data,utils.getNonce());
  return result;
}

export async function addNodePubKey(data) {
  let result = await utils.updateChain('AddNodePublicKey',data,utils.getNonce());
  return result;
}

export async function handleMessageFromQueue(message) {
  if(!callbackUrl) {
    console.error('callbackUrl for IDP not set');
    return;
  }
  fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message)
  })
}

export async function handleNodeLogicCallback(requestId) {
  //TODO
  console.log('IDP get callback from node logic with requestId:',requestId);
  await checkIntegrity();
}

//===================== Initialize before flow can start =======================

export async function init() {
  //users associate with this idp
  let userList = JSON.parse(
    fs.readFileSync(process.env.ASSOC_USERS,'utf8').toString()
  );

  let users = [];
  for(let i in userList) {
    let elem = userList[i];
    users.push({
      hash_id: await utils.hash(elem.namespace + ':' + elem.identifier),
      ial: elem.ial
    })
  }
  let node_id = config.msqRegister.ip + ':' + config.msqRegister.port;

  //register node id, which is substituted with ip,port for demo
  registerMsqDestination({
    users,
    node_id,
  });

  addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key'
  });

  eventEmitter.on('message',function(message) {
    console.log('IDP receive message from msq:',message);
    handleMessageFromQueue(message);
  });
}