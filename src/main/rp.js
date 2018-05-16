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
  transactions.forEach(async (transaction) => {
    const requestId = transaction.args.request_id; //derive from tx;

    const callbackUrl = await db.getCallbackUrl(requestId);
    //this request is not concern this RP
    if (!callbackUrl) return;

    const request = await common.getRequest({ requestId });
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

    if (request.status === 'completed') {
      const requestData = await db.getRequestToSendToAS(requestId);
      if (requestData != null) {
        const height = tendermint.getHeightFromTendermintNewBlockEvent(result);
        await sendRequestToAS(requestData, height);
      } else {
        // Authen only, no data request

        // Clear callback url mapping and reference ID mapping
        // since the request is no longer going to have further events
        // (the request has reached its end state)
        db.removeCallbackUrl(requestId);
        db.removeRequestIdReferenceIdMappingByRequestId(requestId);
      }
    } else if (request.status === 'rejected' || request.status === 'closed') {
      // Clear callback url mapping, reference ID mapping, and request data to send to AS
      // since the request is no longer going to have further events
      // (the request has reached its end state)
      db.removeCallbackUrl(requestId);
      db.removeRequestIdReferenceIdMappingByRequestId(requestId);
      db.removeRequestToSendToAS(requestId);
    }
  });
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
  let nodeIdList;
  if (!data_request.as_id_list || data_request.as_id_list.length === 0) {
    nodeIdList = await getAsMqDestination({
      //as_id: as,
      service_id: data_request.service_id,
    });
  } else nodeIdList = data_request.as_id_list;

  const receivers = (await Promise.all(
    nodeIdList.map(async (asNodeId) => {
      try {
        //let nodeId = node.node_id;
        let { ip, port } = await common.getMsqAddress(asNodeId);
        return {
          ip,
          port,
          ...(await common.getNodePubKey(asNodeId)),
        };
      } catch (error) {
        return null;
      }
    })
  )).filter((elem) => elem !== null);
  return receivers;
}

async function sendRequestToAS(requestData, height) {
  // console.log(requestData);
  // node id, which is substituted with ip,port for demo
  let rp_node_id = config.nodeId;
  if (requestData.data_request_list != undefined) {
    requestData.data_request_list.forEach(async (data_request) => {
      let receivers = await getASReceiverList(data_request);
      if (receivers.length === 0) {
        console.error('No AS found');
        return;
      }

      mq.send(receivers, {
        request_id: requestData.request_id,
        namespace: requestData.namespace,
        identifier: requestData.identifier,
        service_id: data_request.service_id,
        request_params: data_request.request_params,
        rp_node_id: rp_node_id,
        request_message: requestData.request_message,
        height,
      });
    });
  }
}

export async function getIdpsMsqDestination({
  namespace,
  identifier,
  min_ial,
  idp_list,
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
    if (idp_list != null && idp_list.length !== 0) {
      if (idp_list.indexOf(nodeId) === -1) continue;
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

/**
 * Create a new request
 * @param {Object} request
 * @param {string} request.namespace
 * @param {string} request.reference_id
 * @param {Array.<string>} request.idp_list
 * @param {string} request.callback_url
 * @param {Array.<Object>} request.data_request_list
 * @param {string} request.request_message
 * @param {number} request.min_ial
 * @param {number} request.min_aal
 * @param {number} request.min_idp
 * @param {number} request.request_timeout
 * @returns {Promise<string>} Request ID
 */
export async function createRequest({
  namespace,
  identifier,
  reference_id,
  idp_list,
  callback_url,
  data_request_list,
  request_message,
  min_ial,
  min_aal,
  min_idp,
  request_timeout,
}) {
  // existing reference_id, return request ID
  const requestId = await db.getRequestIdByReferenceId(reference_id);
  if (requestId) {
    return requestId;
  }

  let receivers = await getIdpsMsqDestination({
    namespace,
    identifier,
    min_ial,
    idp_list,
  });

  if (receivers.length === 0) {
    console.error('No IDP found');
    return null;
  }

  const nonce = utils.getNonce();
  const request_id = utils.createRequestId();

  const dataRequestListToBlockchain = [];
  for (let i in data_request_list) {
    dataRequestListToBlockchain.push({
      service_id: data_request_list[i].service_id,
      as_id_list: data_request_list[i].as_id_list,
      count: data_request_list[i].count,
      request_params_hash: utils.hash(
        JSON.stringify(data_request_list[i].request_params)
      ),
    });
  }

  const requestData = {
    namespace,
    identifier,
    request_id,
    min_idp: min_idp ? min_idp : 1,
    min_aal: min_aal,
    min_ial: min_ial,
    request_timeout,
    data_request_list: data_request_list,
    request_message,
  };

  // save request data to DB to send to AS via mq when authen complete
  if (data_request_list != null && data_request_list.length !== 0) {
    await db.setRequestToSendToAS(request_id, requestData);
  }

  // add data to blockchain
  const requestDataToBlockchain = {
    request_id,
    min_idp: min_idp ? min_idp : 1,
    min_aal,
    min_ial,
    request_timeout,
    data_request_list: dataRequestListToBlockchain,
    message_hash: utils.hash(request_message),
  };
  const [success, height] = await tendermint.transact(
    'CreateRequest',
    requestDataToBlockchain,
    nonce
  );
  if (!success) return null;

  addTimeoutScheduler(request_id,request_timeout);

  // send request data to IDPs via message queue
  mq.send(receivers, {
    ...requestData,
    height,
  });

  // maintain mapping
  await db.setRequestIdByReferenceId(reference_id, request_id);
  await db.setCallbackUrl(request_id, callback_url);
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
    //as_id: data.as_id,
    service_id: data.service_id,
  });
}

export function getDataFromAS(requestId) {
  return db.getDatafromAS(requestId);
}

export function removeDataFromAS(requestId) {
  return db.removeDataFromAS(requestId);
}

export function removeAllDataFromAS() {
  return db.removeAllDataFromAS();
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
      const callbackUrl = await db.getCallbackUrl(data.request_id);

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
      db.removeCallbackUrl(data.request_id);
    } catch (error) {
      console.log(
        'Cannot send callback to client application with the following error:',
        error
      );
    }
  }

  await db.addDataFromAS(data.request_id, {
    data: data.data,
    as_id: data.as_id,
  });

  // Clear callback url mapping, reference ID mapping, and request data to send to AS
  // since the request is no longer going to have further events
  db.removeCallbackUrl(data.request_id);
  db.removeRequestIdReferenceIdMappingByRequestId(data.request_id);
  db.removeRequestToSendToAS(data.request_id);
}

function addTimeoutScheduler(requestId, secondsToTimeout) {
  let unixTimeout = Date.now() + secondsToTimeout*1000;
  //TODO add unixTimeout to persistent

  setTimeout(async function() {
    let request = common.getRequest({ requestId });
    switch(request.status) {
      case 'complicated':
      case 'pending':
      case 'confirmed':
      case 'rejected':
        //TODO close request
        break;
      default:
        //Do nothing
    }
    //TODO remove from persistent

  },Math.max(0,secondsToTimeout*1000));
}

export async function init() {
  //TODO get all scheduler from persistent
  let scheduler = [];
  scheduler.forEach(({requestId, unixTimeout}) => {
    addTimeoutScheduler(requestId, (unixTimeout - Date.now())/1000 );
  });

  //In production this should be done only once in phase 1,
  common.registerMsqAddress(config.mqRegister);
  
}

if (config.role === 'rp') {
  eventEmitter.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
