import { eventEmitter } from '../mq';

import * as mq from '../mq';
import * as utils from './utils';
import * as config from '../config';
import * as common from '../main/common';

const privKey = 'AS_PrivateKey';
let mqReceivingQueue = {};
let blockchainQueue = {};

async function sendDataToRP(data) {
  let receivers = [];
  let nodeId = data.rp_node_id;
  let [ip, port] = nodeId.split(':');
  receivers.push({
    ip,
    port,
    ...(await common.getNodePubKey(nodeId))
  });
  mq.send(receivers, {
    as_id: data.as_id,
    data: data.data
  });
}

async function signData(data) {
  let nonce = utils.getNonce();
  let dataToBlockchain = {
    as_id: data.as_id,
    request_id: data.request_id,
    signature: data.signature
  };
  utils.updateChain('SignData', dataToBlockchain, nonce);
}

async function registerServiceDestination(data) {
  let nonce = utils.getNonce();
  let dataToBlockchain = {
    as_id: data.as_id,
    service_id: data.service_id,
    node_id: data.node_id
  };
  utils.updateChain('RegisterServiceDestination', dataToBlockchain, nonce);
}

async function checkIntegrity(requestId) {
  if (mqReceivingQueue[requestId] && blockchainQueue[requestId]) {
    let msgBlockchain = blockchainQueue[requestId];
    let message = mqReceivingQueue[requestId];

    if (
      msgBlockchain.messageHash === (await utils.hash(message.request_message))
    ) {
      const requestDetail = await utils.queryChain('GetRequestDetail', {
        requestId: message.request_id
      });

      // TODO
      // Verify that (number of consent ≥ min_idp in request).
      // For each consent with matching request ID:
      // Verify the identity proof.
      // Verify the signature.
      // Verify that the message_hash is matching with the request.

      // Get all signature
      let signatures = [];
      requestDetail.responses.forEach(response => {
        signatures.push(response.signature);
      });

      // Calculate max ial && max aal
      let max_ial = 0;
      let max_aal = 0;
      requestDetail.responses.forEach(response => {
        if (response.aal > max_aal) max_aal = response.aal;
        if (response.ial > max_ial) max_ial = response.ial;
      });

      // Then callback to AS.
      console.log('Callback to AS', {
        request_id: message.request_id,
        request_params: message.request_params,
        signatures,
        max_ial,
        max_aal
      });

      // AS→Platform
      // The AS replies synchronously with the requested data

      // When received data
      let data = 'mock data';
      let as_id = config.asID;
      let signature = 'sign(' + data + ',' + privKey + ')';
      // AS node encrypts the response and sends it back to RP via NSQ.
      sendDataToRP({ rp_node_id: message.rp_node_id, as_id, data });

      // AS node adds transaction to blockchain
      signData({ as_id, request_id: message.request_id, signature });
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
  console.log('AS receive message from mq:', request);
  let requestJson = JSON.parse(request);
  mqReceivingQueue[requestJson.request_id] = requestJson;
  checkIntegrity(requestJson.request_id);
}

export async function handleABCIAppCallback(requestId) {
  console.log('Callback (event) from ABCI app; requestId:', requestId);
  const request = await common.getRequest({ requestId });
  if (request.status === 'completed') {
    blockchainQueue[requestId] = await request;
    checkIntegrity(requestId);
  }
}

//===================== Initialize before flow can start =======================

export async function init() {
  // In production environment, this should be done with register service process.
  // TODO
  //register node id, which is substituted with ip,port for demo
  let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
  // Hard code add back statement service for demo
  registerServiceDestination({
    as_id: config.asID,
    service_id: 'bank_statement',
    node_id: node_id
  });

  common.addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key'
  });
}

if (config.role === 'as') {
  eventEmitter.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
