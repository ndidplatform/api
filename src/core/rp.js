import fetch from 'node-fetch';

import CustomError from '../error/customError';
import errorType from '../error/type';
import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as utils from '../utils';
import * as mq from '../mq';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';

let timeoutScheduler = {};

export function clearAllScheduler() {
  for (let requestId in timeoutScheduler) {
    clearTimeout(timeoutScheduler[requestId]);
  }
}

async function checkAndNotify(requestId, idp_id, height, dataFromMq) {

  logger.debug({
    message: 'RP check zk proof and notify',
    requestId,
    idp_id,
  });

  const request = await common.getRequest({
    requestId,
  });

  const callbackUrl = await db.getRequestCallbackUrl(requestId);
  if (!callbackUrl) return []; // This RP does not concern this request

  // TODO: try catch / error handling
  const requestDetail = await common.getRequestDetail({
    requestId: requestId,
  });

  if (!requestDetail.responses) {
    requestDetail.responses = [];
  }

  const idpCountOk =
    requestDetail.responses.length === requestDetail.min_idp;
  const responsesValid = await verifyZKProof(requestId, idp_id, dataFromMq);

  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request: {
          idpCountOk,
          responsesValid,
          ...request,
        }
      }),
    });
  } catch (error) {
    logger.error({
      message: 'Cannot send callback to client application',
      error,
    });

    // TODO: error handling
    // retry?
  }

  logger.debug({
    message: 'Check to notify AS',
    request,
    idpCountOk,
    requestDetail
  });

  if (request.status === 'confirmed' && idpCountOk) {
    const requestData = await db.getRequestToSendToAS(requestId);
    if (requestData != null) {
      //const height = block.block.header.height;
      //tendermint.getBlockHeightFromNewBlockHeaderEvent(
        //result
      //);
      // TODO: try catch / error handling
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

  //loop through all those block before, and verify all proof
  logger.debug({
    message: 'Getting request IDs to process responses',
    fromHeight,
    toHeight,
  });

  const responseIdsInTendermintBlock = await db.getResponseIdsExpectedInBlock(
    fromHeight,
    toHeight
  );

  await Promise.all(
    responseIdsInTendermintBlock.map(async (responseId) => {
      // TODO: clear key with smart-contract, eg. request_id or requestId
      const [requestId, idp_id] = responseId.split(':');
      await checkAndNotify(requestId, idp_id, height); 
      db.removeProofReceivedFromMQ(responseId);
    })
  );
  db.removeResponseIdsExpectedInBlock(fromHeight, toHeight);
}

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

  logger.debug({
    message: 'RP call AS',
    requestData,
    height,
  });

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
        rp_id: requestData.rp_id,
        request_message: requestData.request_message,
        height,
        challenge: requestData.challenge,
        privateProofObjectList :requestData.privateProofObjectList,
      });
    });
  }
}

export async function getIdpsMsqDestination({
  namespace,
  identifier,
  min_ial,
  min_aal,
  idp_list,
}) {
  const foundIdps = await common.getNodeIdsOfAssociatedIdp({
    namespace,
    identifier,
    min_ial,
    min_aal,
  });

  let nodeIdList = foundIdps.node;
  let receivers = [];

  if (nodeIdList != null) {
    //prepare receiver for mq
    for (let i in nodeIdList) {
      let nodeId = nodeIdList[i].id;
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
  try {
    // existing reference_id, return request ID
    const requestId = await db.getRequestIdByReferenceId(reference_id);
    if (requestId) {
      return requestId;
    }

    if (idp_list != null && idp_list.length > 0 && idp_list.length < min_idp) {
      throw new CustomError({
        message: errorType.IDP_LIST_LESS_THAN_MIN_IDP.message,
        code: errorType.IDP_LIST_LESS_THAN_MIN_IDP.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_list,
        },
      });
    }

    let receivers = await getIdpsMsqDestination({
      namespace,
      identifier,
      min_ial,
      min_aal,
      idp_list,
    });

    if (receivers.length === 0) {
      throw new CustomError({
        message: errorType.NO_IDP_FOUND.message,
        code: errorType.NO_IDP_FOUND.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_list,
        },
      });
    }

    if (receivers.length < min_idp) {
      throw new CustomError({
        message: errorType.NOT_ENOUGH_IDP.message,
        code: errorType.NOT_ENOUGH_IDP.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_list,
        },
      });
    }

    const nonce = utils.getNonce();
    const request_id = utils.createRequestId();

    const dataRequestListToBlockchain = [];
    for (let i in data_request_list) {
      dataRequestListToBlockchain.push({
        service_id: data_request_list[i].service_id,
        as_id_list: data_request_list[i].as_id_list,
        count: data_request_list[i].count,
        request_params_hash: utils.hashWithRandomSalt(
          JSON.stringify(data_request_list[i].request_params)
        ),
      });
    }

    let challenge = utils.randomHexBytes(config.challengeLength);
    db.setChallengeFromRequestId(request_id, challenge);

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
      // for zk proof
      challenge,
      rp_id: config.nodeId,
    };

    // save request data to DB to send to AS via mq when authen complete
    // store even no data require, use for zk proof
    //if (data_request_list != null && data_request_list.length !== 0) {
      await db.setRequestToSendToAS(request_id, requestData);
    //}

    // add data to blockchain
    const requestDataToBlockchain = {
      request_id,
      min_idp: min_idp ? min_idp : 1,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list: dataRequestListToBlockchain,
      message_hash: utils.hash(challenge + request_message),
    };

    const { height } = await tendermint.transact(
      'CreateRequest',
      requestDataToBlockchain,
      nonce
    );

    // send request data to IDPs via message queue
    mq.send(receivers, {
      ...requestData,
      height,
    });

    addTimeoutScheduler(request_id, request_timeout);

    // maintain mapping
    await db.setRequestIdByReferenceId(reference_id, request_id);
    await db.setRequestCallbackUrl(request_id, callback_url);
    return request_id;
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create request',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

export async function getRequestIdByReferenceId(referenceId) {
  try {
    return await db.getRequestIdByReferenceId(referenceId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get data received from AS',
      cause: error,
    });
  }
}

export async function getDataFromAS(requestId) {
  try {
    // Check if request exists
    const request = await common.getRequest({ requestId });
    if (request == null) {
      return null;
    }

    return await db.getDatafromAS(requestId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get data received from AS',
      cause: error,
    });
  }
}

export async function removeDataFromAS(requestId) {
  try {
    return await db.removeDataFromAS(requestId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot remove data received from AS',
      cause: error,
    });
  }
}

export async function removeAllDataFromAS() {
  try {
    return await db.removeAllDataFromAS();
  } catch (error) {
    throw new CustomError({
      message: 'Cannot remove all data received from AS',
      cause: error,
    });
  }
}

export async function handleMessageFromQueue(data) {

  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    data,
  });

  data = JSON.parse(data);
  //distinguish between message from idp, as
  if(!data.as_id) {
    if(!data.idp_id) {
      //invalid message
      throw 'something';
    }

    //store private parameter from EACH idp to request, to pass along to as
    let request = await db.getRequestToSendToAS(data.request_id);
    //AS involve
    if(request) {
      if(request.privateProofObjectList) {
        request.privateProofObjectList.push({
          idp_id: data.idp_id,
          privateProofObject: {
            privateProofValue: data.privateProofValue,
            accessor_id: data.accessor_id,
          }
        });
      }
      else {
        request.privateProofObjectList = [{
          idp_id: data.idp_id,
          privateProofObject: {
            privateProofValue: data.privateProofValue,
            accessor_id: data.accessor_id,
          }
        }];
      }
      await db.setRequestToSendToAS(data.request_id, request);
    }

    //must wait for height
    const latestBlockHeight = tendermint.latestBlockHeight;
    const responseId = data.request_id + ':' + data.idp_id;
    
    if (latestBlockHeight <= data.height) {
      logger.debug({
        message: 'Saving message from MQ',
        tendermintLatestBlockHeight: latestBlockHeight,
        messageBlockHeight: data.height,
      });
      db.setProofReceivedFromMQ(responseId, data);
      db.addResponseIdsExpectedInBlock(
        data.height,
        responseId
      );
      return;
    }
    checkAndNotify(data.request_id, data.idp_id, latestBlockHeight, data);
  }

  //receive data from AS
  // TODO: verifies signature of AS in blockchain.
  // Call callback to RP.

  try {
    const request = await common.getRequest({
      requestId: data.request_id,
    });
    //data arrived too late, ignore data
    if (request.is_closed || request.is_timed_out) return;
  } catch (error) {
    // TODO: error handling
    throw error;
  }

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
  try {
    const request = await common.getRequest({ requestId });
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
  } catch (error) {
    // TODO: error handling
    throw error;
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

  // Wait for blockchain ready
  await tendermint.ready;

  common.registerMsqAddress(config.mqRegister);
}

async function verifyZKProof(request_id, idp_id, dataFromMq) {
  let challenge = await db.getChallengeFromRequestId(request_id);
  let privateProofObject = dataFromMq 
    ? dataFromMq 
    : await db.getProofReceivedFromMQ(request_id + ':' + idp_id);

  //query and verify zk, also check conflict with each others
  logger.debug({
    message: 'RP verifying zk proof',
    request_id,
    idp_id,
    dataFromMq,
    challenge,
    privateProofObject
  });

  //query accessor_group_id of this accessor_id
  let accessor_group_id = await common.getAccessorGroupId(privateProofObject.accessor_id);
  //and check against all accessor_group_id of responses
  let { namespace,identifier,privateProofObjectList } = (await db.getRequestToSendToAS(request_id));

  logger.debug({
    message: 'RP verifying zk proof',
    privateProofObjectList,
  });

  for(let i = 0 ; i < privateProofObjectList.length ; i++) {
    let otherPrivateProofObject = privateProofObjectList[i].privateProofObject;
    let otherGroupId = await common.getAccessorGroupId(otherPrivateProofObject.accessor_id);
    if(otherGroupId !== accessor_group_id) {
      //TODO handle this, manually close?
      logger.debug({
        message: 'Conflict response',
        otherGroupId,
        otherPrivateProofObject,
        accessor_group_id,
        accessorId: privateProofObject.accessor_id,
      });
      throw 'Conflicted response';
    }
  }

  //query accessor_public_key from privateProofObject.accessor_id
  let public_key = await common.getAccessorKey(privateProofObject.accessor_id);

  //query publicProof from response of idp_id in request
  let publicProof;
  let responses = (await common.getRequestDetail({
    requestId: request_id
  })).responses;

  logger.debug({
    message: 'Request detail',
    responses,
  });

  responses.forEach((response) => {
    if(response.idp_id === idp_id) publicProof = response.identity_proof;
  });

  return utils.verifyZKProof(
    public_key, 
    challenge, 
    privateProofObject.privateProofValue, 
    publicProof, 
    {
      namespace,
      identifier
    }
  );
}