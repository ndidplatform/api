import fetch from 'node-fetch';

import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as utils from '../utils';
import * as mq from '../mq';
import * as config from '../config';
import * as common from '../main/common';
import * as db from '../db';

let timeoutScheduler = {};

export function clearAllScheduler() {
  for (let requestId in timeoutScheduler) {
    clearTimeout(timeoutScheduler[requestId]);
  }
}

export async function handleTendermintNewBlockHeaderEvent(
  error,
  result,
  missingBlockCount
) {
  if (missingBlockCount == null) return;

  const height = tendermint.getBlockHeightFromNewBlockHeaderEvent(result);
  const fromHeight =
    missingBlockCount === 0 ? height - 1 : height - missingBlockCount;
  const toHeight = height - 1;
  const blocks = await common.getBlocks(fromHeight, toHeight);
  await Promise.all(
    blocks.map(async (block) => {
      let transactions = tendermint.getTransactionListFromBlockQuery(block);
      await Promise.all(
        transactions.map(async (transaction) => {
          // TODO: clear key with smart-contract, eg. request_id or requestId
          const requestId =
            transaction.args.request_id || transaction.args.requestId; //derive from tx;

          const callbackUrl = await db.getRequestCallbackUrl(requestId);

          if (!callbackUrl) return; // This RP does not concern this request

          const request = await common.getRequest({ requestId });
          const requestDetail = await common.getRequestDetail({ requestId });
          if (!requestDetail.responses) {
            requestDetail.responses = [];
          }
          const idpCountOk =
            requestDetail.responses.length === requestDetail.min_idp;
          try {
            await fetch(callbackUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                request: {
                  idpCountOk,
                  ...request,
                },
              }),
            });
          } catch (error) {
            logger.error({
              message: 'Cannot send callback to client application',
              error,
            });
          }

          if (request.status === 'confirmed' && idpCountOk) {
            const requestData = await db.getRequestToSendToAS(requestId);
            if (requestData != null) {
              const height = block.block.header.height;
              /*tendermint.getBlockHeightFromNewBlockHeaderEvent(
            result
          );*/
              await sendRequestToAS(requestData, height);
            } else {
              // Authen only, no data request

              // Clear callback url mapping and reference ID mapping
              // since the request is no longer going to have further events
              // (the request has reached its end state)
              db.removeRequestCallbackUrl(requestId);
              db.removeRequestIdReferenceIdMappingByRequestId(requestId);
              db.removeTimeoutScheduler(requestId);
              clearTimeout(timeoutScheduler[requestId]);
              delete timeoutScheduler[requestId];
            }
          } else if (
            request.status === 'rejected' ||
            request.is_closed ||
            request.is_timed_out
          ) {
            // Clear callback url mapping, reference ID mapping, and request data to send to AS
            // since the request is no longer going to have further events
            // (the request has reached its end state)
            db.removeRequestCallbackUrl(requestId);
            db.removeRequestIdReferenceIdMappingByRequestId(requestId);
            db.removeRequestToSendToAS(requestId);
            db.removeTimeoutScheduler(requestId);
            clearTimeout(timeoutScheduler[requestId]);
            delete timeoutScheduler[requestId];
          }
        })
      );
    })
  );
}

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
    nodeIdList = await common.getNodeIdsOfAsWithService({
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
  // node id, which is substituted with ip,port for demo
  let rp_node_id = config.nodeId;
  if (requestData.data_request_list != undefined) {
    requestData.data_request_list.forEach(async (data_request) => {
      let receivers = await getASReceiverList(data_request);
      if (receivers.length === 0) {
        logger.error({
          message: 'No AS found',
          data_request,
        });
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
  let foundedIdpList = await common.getNodeIdsOfAssociatedIdp({
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
    logger.error({
      message: 'No IDP found',
      namespace,
      identifier,
      idp_list,
    });
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

  addTimeoutScheduler(request_id, request_timeout);

  // send request data to IDPs via message queue
  mq.send(receivers, {
    ...requestData,
    height,
  });

  // maintain mapping
  await db.setRequestIdByReferenceId(reference_id, request_id);
  await db.setRequestCallbackUrl(request_id, callback_url);
  return request_id;
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

export async function handleMessageFromQueue(data) {
  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    data,
  });

  // Verifies signature in blockchain.
  // RP node updates the request status
  // Call callback to RP.

  //receive data from AS
  data = JSON.parse(data);
  let request = await common.getRequest({ requestId: data.request_id });
  //data arrived too late, ignore data
  if (request.is_closed || request.is_timed_out) return;
  if (data.data) {
    try {
      const callbackUrl = await db.getRequestCallbackUrl(data.request_id);

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
      db.removeRequestCallbackUrl(data.request_id);
    } catch (error) {
      logger.warn({
        message: 'Cannot send callback to client application (RP)',
        error,
      });
    }
  }

  await db.addDataFromAS(data.request_id, {
    data: data.data,
    as_id: data.as_id,
  });

  // Clear callback url mapping, reference ID mapping, and request data to send to AS
  // since the request is no longer going to have further events
  db.removeRequestCallbackUrl(data.request_id);
  db.removeRequestIdReferenceIdMappingByRequestId(data.request_id);
  db.removeRequestToSendToAS(data.request_id);
  db.removeTimeoutScheduler(data.request_id);
  clearTimeout(timeoutScheduler[data.request_id]);
  delete timeoutScheduler[data.request_id];
}

async function timeoutRequest(requestId) {
  let request = await common.getRequest({ requestId });
  switch (request.status) {
    case 'complicated':
    case 'pending':
    case 'confirmed':
      await tendermint.transact(
        'TimeOutRequest',
        { requestId },
        utils.getNonce()
      );
      break;
    default:
    //Do nothing
  }
  db.removeTimeoutScheduler(requestId);
}

function runTimeoutScheduler(requestId, secondsToTimeout) {
  if (secondsToTimeout < 0) timeoutRequest(requestId);
  else {
    timeoutScheduler[requestId] = setTimeout(() => {
      timeoutRequest(requestId);
    }, secondsToTimeout * 1000);
  }
}

function addTimeoutScheduler(requestId, secondsToTimeout) {
  let unixTimeout = Date.now() + secondsToTimeout * 1000;
  db.addTimeoutScheduler(requestId, unixTimeout);
  runTimeoutScheduler(requestId, secondsToTimeout);
}

export async function init() {
  let scheduler = await db.getAllTimeoutScheduler();
  scheduler.forEach(({ requestId, unixTimeout }) => {
    runTimeoutScheduler(requestId, (unixTimeout - Date.now()) / 1000);
  });

  //In production this should be done only once in phase 1,
  common.registerMsqAddress(config.mqRegister);
}
