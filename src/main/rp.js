import fetch from 'node-fetch';
import * as utils from './utils';
import * as mq from '../mq';
import { eventEmitter } from '../mq';

const privKey = 'RP_PrivateKey';

let referenceMapping = {};
let callbackUrls = {};
let requestsData = {};

export const handleABCIAppCallback = async requestId => {
  if (callbackUrls[requestId]) {
    const request = await utils.queryChain('GetRequest', { requestId });

    try {
      await fetch(callbackUrls[requestId], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request
        })
      });
    } catch (error) {
      console.log(
        'Cannot send callback to client application with the following error:',
        error
      );
    }

    // Clear callback url mapping when the request is no longer going to have further events
    if (request.status === 'completed' || request.status === 'rejected') {
      delete callbackUrls[requestId];
    }
  }

  if (requestsData[requestId]) {
    const request = await utils.queryChain('GetRequest', { requestId });
    let requestData = await requestsData[requestId];

    if (request.status === 'completed') {
      // Send request to AS when completed
      sendRequestToAS(requestData);
    }
  }
};

async function getASReceiverList(data_request) {
  let receivers = [];
  data_request.as.forEach(async as => {
    getAsMqDestination({
      as_id: as,
      as_service_id: data_request.as_service_id
    }).then(async nodeId => {
      let [ip, port] = nodeId.split(':');
      receivers.push({
        ip,
        port,
        public_key: 'public_key'
      });
    });
  });
  return receivers;
}

async function sendRequestToAS(requestData) {
  requestData.data_request_list.forEach(async data_request => {
    let receivers = await getASReceiverList(data_request);
    mq.send(receivers, {
      request_id: requestData.request_id,
      namespace: requestData.namespace,
      identifier: requestData.identifier,
      service_id: data_request.service_id,
      request_params: data_request.request_params,
      rp_node_id: '127.0.0.1:5554',
      request_message: requestData.request_message
    });
  });
}

export async function createRequest({
  namespace,
  identifier,
  reference_id,
  ...data
}) {
  //existing reference_id, return
  if (referenceMapping[reference_id]) return referenceMapping[reference_id];

  let nonce = utils.getNonce();
  let request_id = await utils.createRequestId(privKey, data, nonce);

  //save request data to DB
  requestsData[request_id] = {
    namespace,
    identifier,
    reference_id,
    request_id,
    min_idp: data.minIdp ? data.minIdp : 1,
    min_aal: data.min_aal ? data.min_aal : 1,
    min_ial: data.min_ial ? data.min_ial : 1,
    timeout: data.timeout,
    data_request_list: data.data_request_list,
    request_message: data.request_message
  };

  //add data to blockchain
  let dataToBlockchain = {
    request_id,
    min_idp: data.minIdp ? data.minIdp : 1,
    min_aal: data.min_aal,
    min_ial: data.min_ial,
    timeout: data.timeout,
    data_request_list: data.data_request_list,
    message_hash: await utils.hash(data.request_message)
  };
  utils.updateChain('CreateRequest', dataToBlockchain, nonce);

  //query node_id and public_key to send data via mq
  getIdpMqDestination({
    namespace,
    identifier,
    min_ial: data.min_ial
  }).then(async ({ node_id }) => {
    let receivers = [];

    //prepare data for mq
    for (let i in node_id) {
      let nodeId = node_id[i];
      let [ip, port] = nodeId.split(':');
      receivers.push({
        ip,
        port,
        ...(await getNodePubKey(nodeId))
      });
    }

    //send via message queue
    mq.send(receivers, {
      namespace,
      identifier,
      request_id,
      min_idp: data.minIdp ? data.minIdp : 1,
      min_aal: data.min_aal ? data.min_aal : 1,
      min_ial: data.min_ial ? data.min_ial : 1,
      timeout: data.timeout,
      data_request_list: data.data_request_list,
      request_message: data.request_message
    });
  });

  //maintain mapping
  referenceMapping[reference_id] = request_id;
  callbackUrls[request_id] = data.callback_url;
  return request_id;
}

export async function getIdpMqDestination(data) {
  return await utils.queryChain('GetMsqDestination', {
    hash_id: await utils.hash(data.namespace + ':' + data.identifier),
    min_ial: data.min_ial
  });
}

export async function getAsMqDestination(data) {
  return '127.0.0.1:5556';
  // return await utils.queryChain('GetMsqServiceDestination', {
  //   as_id: data.as_id,
  //   as_service_id: data.as_service_id
  // });
}

export async function getNodePubKey(node_id) {
  return await utils.queryChain('GetNodePublicKey', { node_id });
}

async function handleMessageFromQueue(request) {
  console.log('RP receive message from mq:', request);
  // Verifies signature in blockchain.
  // RP node updates the request status
  // Call callback to RP.
}

eventEmitter.on('message', function(message) {
  console.log('message');
  handleMessageFromQueue(message);
});
