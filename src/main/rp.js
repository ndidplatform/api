import fetch from 'node-fetch';
import { eventEmitter } from '../mq';

import * as tendermint from '../tendermint/ndid';
import * as utils from '../utils';
import * as mq from '../mq';
import * as config from '../config';
import * as common from '../main/common';
import * as db from '../db';

export const handleTendermintNewBlockEvent = async (error, result) => {
  let transactions = tendermint.getTransactionListFromTendermintNewBlockEvent(
    result
  );
  for (let i in transactions) {
    //all tx
    let requestId = transactions[i].args.request_id; //derive from tx;

    const callbackUrl = await db.get('callbackUrls', requestId);
    //this request is not concern this RP
    if (!callbackUrl) continue;

    common.getRequest({ requestId }).then(async (request) => {
      try {
        await fetch(callbackUrl, {
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
        db.del('callbackUrls', requestId);
      }

      const requestData = await db.get('requestsData', requestId);
      if (requestData) {
        if (request.status === 'completed') {
          // Send request to AS when completed
          setTimeout(function() {
            sendRequestToAS(requestData);
            db.del('requestsData', requestId);
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
        let { ip, port } = await common.getMsqAddress(nodeId);
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
  let rp_node_id = config.nodeId;
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

export async function getIdpsMsqDestination({
  namespace,
  identifier,
  min_ial,
  idp_list
}) {
  let foundedIdpList = await getIdpMqDestination({
    namespace,
    identifier,
    min_ial: min_ial,
  });

  let nodeIdList = foundedIdpList ? foundedIdpList.node_id || [] : [];
  let receivers = [];

  //prepare receiver for mq
  for (let i in nodeIdList) {
    let nodeId = nodeIdList[i];
    //filter only those in idp_list
    if(idp_list != null && idp_list.length !== 0) {
      if(idp_list.indexOf(nodeId) === -1) continue;
    }
    
    let { ip, port } = await common.getMsqAddress(nodeId);

    receivers.push({
      ip,
      port,
      ...(await common.getNodePubKey(nodeId)),
    });
  }
  return receivers;
}

export async function createRequest({
  namespace,
  identifier,
  reference_id,
  data_request_list,
  ...data
}) {
  //existing reference_id, return
  const requestId = await db.get('requestReferenceMapping', reference_id);
  if (requestId) {
    return requestId;
  }

  let receivers = await getIdpsMsqDestination({
    namespace,
    identifier,
    min_ial: data.min_ial ? data.min_ial : 1,
    idp_list: data.idp_list
  });

  if(receivers.length === 0) {
    console.error('NO IDP FOUND');
    return false;
  }

  let nonce = utils.getNonce();
  let request_id = utils.createRequestId();

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
  if (data_request_list != null && data_request_list.length !== 0) {
    await db.put('requestsData', request_id, {
      namespace,
      identifier,
      reference_id,
      request_id,
      min_idp: data.min_idp ? data.min_idp : 1,
      min_aal: data.min_aal ? data.min_aal : 1,
      min_ial: data.min_ial ? data.min_ial : 1,
      timeout: data.timeout,
      data_request_list: data_request_list,
      request_message: data.request_message,
    });
  }

  //add data to blockchain
  let dataToBlockchain = {
    request_id,
    min_idp: data.min_idp ? data.min_idp : 1,
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

  //send via message queue
  mq.send(receivers, {
    namespace,
    identifier,
    request_id,
    min_idp: data.min_idp ? data.min_idp : 1,
    min_aal: data.min_aal ? data.min_aal : 1,
    min_ial: data.min_ial ? data.min_ial : 1,
    timeout: data.timeout,
    data_request_list: data_request_list,
    request_message: data.request_message,
    height,
  });

  //maintain mapping
  await db.put('requestReferenceMapping', reference_id, request_id);
  await db.put('callbackUrls', request_id, data.callback_url);
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
  return db.get('dataFromAS', request_id);
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
      const callbackUrl = await db.get('callbackUrls', data.request_id);

      await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: data.data,
          as_id: data.as_id,
        }),
      });
      db.del('callbackUrls', data.request_id);
    } catch (error) {
      console.log(
        'Cannot send callback to client application with the following error:',
        error
      );
    }
  }

  await db.put('dataFromAS', data.request_id, {
    data: data.data,
    as_id: data.as_id,
  });
}

export async function init() {
  //TODO
  //In production this should be done only once in phase 1,
  //when RP request to join approved NDID
  //after first approved, RP can add other key and node and endorse themself
  /*let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
  process.env.nodeId = node_id;
  common.addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key_for_rp'
  });*/
  common.registerMsqAddress(config.mqRegister);
}

if (config.role === 'rp') {
  eventEmitter.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
