import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

import * as tendermint from '../tendermint/ndid';
import * as common from '../main/common';
import * as utils from './utils';
import * as config from '../config';

import { eventEmitter } from '../mq';

const privKey = 'IDP_PrivateKey';
let mqReceivingQueue = {};
let requestIdsInTendermintBlock = {};
let blockHeight = 0;

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
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ request })
  });
}

async function checkIntegrity(requestId) {
  
  let msgBlockchain = await common.getRequest({ requestId });
  let message = mqReceivingQueue[requestId];
  let valid = false;

  valid = msgBlockchain.messageHash === utils.hash(message.request_message);
  if(!valid) console.error(
    'Mq and blockchain not matched!!',
    message.request_message,
    msgBlockchain.messageHash
  );

  return valid;

}

async function handleMessageFromQueue(request) {
  console.log('IDP receive message from mq:', request);
  let requestJson = JSON.parse(request);
  mqReceivingQueue[requestJson.request_id] = requestJson;

  if(blockHeight < requestJson.height) {
    if(!requestIdsInTendermintBlock[requestJson.height])
      requestIdsInTendermintBlock[requestJson.height] = [requestJson.request_id];
    else
      requestIdsInTendermintBlock[requestJson.height].push(requestJson.request_id);
    return;
  }

  let valid = await checkIntegrity(requestJson.request_id);
  if(valid) notifyByCallback(requestJson);
}

export async function handleTendermintNewBlockEvent (error, result) {
  //let [transactions, height] = utils.getTransactionListFromTendermintNewBlockEvent(result);
  let height = tendermint.getHeightFromTendermintNewBlockEvent(result);
  
  if(height !== blockHeight + 1) {
    //TODO handle missing events
  }
  blockHeight = height;

  //msq arrive before newBlock event
  if(requestIdsInTendermintBlock[height]) {
    let requestIdsToCheck = requestIdsInTendermintBlock[height];
    delete requestIdsInTendermintBlock[height];
    
    requestIdsToCheck.forEach(async function(requestId) {
      let valid = await checkIntegrity(requestId);
      if(valid) notifyByCallback(mqReceivingQueue[requestId]);
      delete mqReceivingQueue[requestId];
    });
  }  
  // console.log(transactions);
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

/*export async function handleABCIAppCallback(requestId, height) {
  console.log('Callback (event) from ABCI app; requestId:', requestId);
  blockchainQueue[requestId] = await common.getRequestRequireHeight({ requestId }, height);
  checkIntegrity(requestId);
}*/

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
