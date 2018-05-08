import fetch from 'node-fetch';
import { eventEmitter } from '../mq';

import * as tendermint from '../tendermint/ndid';
import * as utils from './utils';
import * as mq from '../mq';
import * as config from '../config';
import * as common from '../main/common';

const privKey = 'RP_PrivateKey';

let referenceMapping = {};
let callbackUrls = {};
let requestsData = {};
let dataFromAS = {};

export const handleTendermintNewBlockEvent = async (error, result) => {
  let transactions = tendermint.getTransactionListFromTendermintNewBlockEvent(
    result
  );
  for (let i in transactions) {
    //all tx
    let requestId = transactions[i].args.request_id; //derive from tx;

    //this request is not concern this RP
    if (!callbackUrls[requestId]) continue;

    common.getRequest({ requestId }).then(async (request) => {
      try {
        await fetch(callbackUrls[requestId], {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            request,
          }),
        });
      } catch (error) {
        console.log(
          'Cannot send callback to client application with the following error:',
          error
        );
      }

      // Clear callback url mapping when the request is no longer going to have further events
      if (request.status === 'rejected') {
        delete callbackUrls[requestId];
      }

      if (requestsData[requestId]) {
        let requestData = requestsData[requestId];
        if (request.status === 'completed') {
          // Send request to AS when completed
          setTimeout(function() {
            sendRequestToAS(requestData);
            delete requestsData[requestId];
          }, 1000);
        }
      }
    });
  }
};

/*export const handleABCIAppCallback = async (requestId, height) => {
  if (callbackUrls[requestId]) {
    const request = await common.getRequestRequireHeight({ requestId }, height);

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
    if (request.status === 'rejected') {
      delete callbackUrls[requestId];
    }
  }

  if (requestsData[requestId]) {
    const request = await common.getRequest({ requestId });
    let requestData = requestsData[requestId];

    if (request.status === 'completed') {
      // Send request to AS when completed
      setTimeout(function() {
        sendRequestToAS(requestData);
        delete requestsData[requestId]; 
      }, 1000);
    }
  }
};*/

async function getASReceiverList(data_request) {
  const receivers = (await Promise.all(
    data_request.as_id_list.map(async (as) => {
      try {
        const node = await getAsMqDestination({
          as_id: as,
          service_id: data_request.service_id,
        });

        let nodeId = node.node_id;
        let [ip, port] = nodeId.split(':');
        return {
          ip,
          port,
          ...(await common.getNodePubKey(nodeId)),
        };
      } catch (error) {
        return null;
      }
    })
  )).filter((elem) => elem !== null);
  return receivers;
}

async function sendRequestToAS(requestData) {
  // console.log(requestData);
  // node id, which is substituted with ip,port for demo
  let rp_node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
  if (requestData.data_request_list != undefined) {
    requestData.data_request_list.forEach(async (data_request) => {
      let receivers = await getASReceiverList(data_request);
      mq.send(receivers, {
        request_id: requestData.request_id,
        namespace: requestData.namespace,
        identifier: requestData.identifier,
        service_id: data_request.service_id,
        request_params: data_request.request_params,
        rp_node_id: rp_node_id,
        request_message: requestData.request_message,
      });
    });
  }
}

export async function createRequest({
  namespace,
  identifier,
  reference_id,
  data_request_list,
  ...data
}) {
  //existing reference_id, return
  if (referenceMapping[reference_id]) return referenceMapping[reference_id];

  let nonce = utils.getNonce();
  let request_id = utils.createRequestId(privKey, data, nonce);

  let data_request_list_to_blockchain = [];
  for (let i in data_request_list) {
    data_request_list_to_blockchain.push({
      service_id: data_request_list[i].service_id,
      as_id_list: data_request_list[i].as_id_list,
      count: data_request_list[i].count,
      request_params_hash: utils.hash(
        JSON.stringify(data_request_list[i].request_params)
      ),
    });
  }

  //save request data to DB to send to AS via msq when authen complete
  if (data_request_list.length !== 0) {
    requestsData[request_id] = {
      namespace,
      identifier,
      reference_id,
      request_id,
      min_idp: data.minIdp ? data.minIdp : 1,
      min_aal: data.min_aal ? data.min_aal : 1,
      min_ial: data.min_ial ? data.min_ial : 1,
      timeout: data.timeout,
      data_request_list: data_request_list,
      request_message: data.request_message,
    };
  }

  //add data to blockchain
  let dataToBlockchain = {
    request_id,
    min_idp: data.minIdp ? data.minIdp : 1,
    min_aal: data.min_aal,
    min_ial: data.min_ial,
    timeout: data.timeout,
    data_request_list: data_request_list_to_blockchain,
    message_hash: utils.hash(data.request_message),
  };
  let [success, height] = await tendermint.transact(
    'CreateRequest',
    dataToBlockchain,
    nonce
  );
  if (!success) return false;

  //query node_id and public_key to send data via mq
  getIdpMqDestination({
    namespace,
    identifier,
    min_ial: data.min_ial,
  }).then(async (idpList) => {
    let nodeIdList = idpList ? idpList.node_id || [] : [];
    let receivers = [];
    //prepare data for mq
    for (let i in nodeIdList) {
      let nodeId = nodeIdList[i];
      let [ip, port] = nodeId.split(':');
      receivers.push({
        ip,
        port,
        ...(await common.getNodePubKey(nodeId)),
      });
    }

    //TODO filter receivers by idp_list
    if (receivers.length === 0) {
      //TODO handle when this user not on board or all IDPs in idp_list
      //not associate with this user
      console.error('NO IDP FOUND');
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
      data_request_list: data_request_list,
      request_message: data.request_message,
      height,
    });
  });

  //maintain mapping
  referenceMapping[reference_id] = request_id;
  callbackUrls[request_id] = data.callback_url;
  return request_id;
}

export async function getIdpMqDestination(data) {
  return await tendermint.query('GetMsqDestination', {
    hash_id: utils.hash(data.namespace + ':' + data.identifier),
    min_ial: data.min_ial,
  });
}

export async function getAsMqDestination(data) {
  return await tendermint.query('GetServiceDestination', {
    as_id: data.as_id,
    service_id: data.service_id,
  });
}

export function getDataFromAS(request_id) {
  return dataFromAS[request_id];
}

async function handleMessageFromQueue(data) {
  console.log('RP receive message from mq:', data);
  // Verifies signature in blockchain.
  // RP node updates the request status
  // Call callback to RP.

  //receive data from AS
  data = JSON.parse(data);
  if (data.data) {
    try {
      await fetch(callbackUrls[data.request_id], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: data.data,
          as_id: data.as_id,
        }),
      });
      delete callbackUrls[data.request_id];
    } catch (error) {
      console.log(
        'Cannot send callback to client application with the following error:',
        error
      );
    }
  }

  dataFromAS[data.request_id] = {
    data: data.data,
    as_id: data.as_id,
  };
}

if (config.role === 'rp') {
  eventEmitter.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
