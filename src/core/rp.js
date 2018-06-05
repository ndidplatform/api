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

async function checkAndNotify(requestId, height) {
  // logger.debug({
  //   message: 'RP check zk proof and notify',
  //   requestId,
  // });

  const callbackUrl = await db.getRequestCallbackUrl(requestId);
  if (!callbackUrl) return; // This RP does not concern this request

  // TODO: try catch / error handling
  const requestDetail = await common.getRequestDetail({
    requestId: requestId,
  });

  if (requestDetail.responses == null) {
    requestDetail.responses = [];
  }

  // ZK Proof verification is needed only when got new response from IdP
  let needZKProofVerification = false;
  if (
    (requestDetail.status === 'confirmed' ||
      requestDetail.status === 'complicated' ||
      requestDetail.status === 'rejected') &&
    requestDetail.is_closed === false &&
    requestDetail.is_timed_out === false
  ) {
    if (requestDetail.responses.length < requestDetail.min_idp) {
      needZKProofVerification = true;
    } else if (requestDetail.responses.length === requestDetail.min_idp) {
      let asAnswerCount;
      if (
        requestDetail.data_request_list &&
        Array.isArray(requestDetail.data_request_list)
      ) {
        asAnswerCount = requestDetail.data_request_list.reduce(
          (total, service) => {
            const answerCount =
              service.answered_as_id_list != null
                ? service.answered_as_id_list.length
                : 0;
            return total + answerCount;
          },
          0
        );
      }
      if (asAnswerCount === 0) {
        needZKProofVerification = true;
      }
    }
  }

  if (needZKProofVerification) {
    // Validate ZK Proof
    const idpNodeId = await db.getExpectedIdpResponseNodeId(requestId);

    if (idpNodeId == null) return;

    await checkZKAndNotify(requestDetail, height, idpNodeId, callbackUrl);
    return;
  }

  const eventDataForCallback = {
    type: 'request_event',
    request_id: requestDetail.request_id,
    status: requestDetail.status,
    min_idp: requestDetail.min_idp,
    answered_idp_count: requestDetail.responses.length,
    is_closed: requestDetail.is_closed,
    is_timed_out: requestDetail.is_timed_out,
    service_list: requestDetail.data_request_list.map((service) => ({
      service_id: service.service_id,
      count: service.count,
      answered_count:
        service.answered_as_id_list != null
          ? service.answered_as_id_list.length
          : 0,
    })),
  };

  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventDataForCallback),
    });
  } catch (error) {
    logger.error({
      message: 'Cannot send callback to client application',
      error,
    });

    // TODO: error handling
    // retry?
  }

  if (
    // request.status === 'completed' ||
    requestDetail.status === 'rejected' ||
    requestDetail.is_closed ||
    requestDetail.is_timed_out
  ) {
    // Clean up
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

async function checkZKAndNotify(
  requestDetail,
  height,
  idpId,
  callbackUrl,
  requestData
) {
  logger.debug({
    message: 'Check ZK Proof then notify',
    requestDetail,
    height,
    idpId,
    callbackUrl,
    requestData,
  });
  const responseValid = await verifyZKProof(
    requestDetail.request_id,
    idpId,
    requestData
  );

  if (
    requestDetail.status === 'confirmed' &&
    requestDetail.responses.length === requestDetail.min_idp &&
    responseValid
  ) {
    const requestData = await db.getRequestToSendToAS(requestDetail.request_id);
    if (requestData != null) {
      // TODO: try catch / error handling
      await sendRequestToAS(requestData, height);
    }
  }

  const eventDataForCallback = {
    type: 'request_event',
    request_id: requestDetail.request_id,
    status: requestDetail.status,
    min_idp: requestDetail.min_idp,
    answered_idp_count: requestDetail.responses.length,
    is_closed: requestDetail.is_closed,
    is_timed_out: requestDetail.is_timed_out,
    service_list: requestDetail.data_request_list.map((service) => ({
      service_id: service.service_id,
      count: service.count,
      answered_count:
        service.answered_as_id_list != null
          ? service.answered_as_id_list.length
          : 0,
    })),
    latest_response_valid: responseValid,
  };

  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventDataForCallback),
    });
  } catch (error) {
    logger.error({
      message: 'Cannot send callback to client application',
      error,
    });

    // TODO: error handling
    // retry?
  }

  db.removeProofReceivedFromMQ(`${requestDetail.request_id}:${idpId}`);
  db.removeExpectedIdpResponseNodeId(requestDetail.request_id);
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

  const blocks = await tendermint.getBlocks(fromHeight, toHeight);
  await Promise.all(
    blocks.map(async (block) => {
      let transactions = tendermint.getTransactionListFromBlockQuery(block);
      await Promise.all(
        transactions.map(async (transaction) => {
          // TODO: clear key with smart-contract, eg. request_id or requestId
          const requestId =
            transaction.args.request_id || transaction.args.requestId; //derive from tx;
          const height = block.block.header.height;
          await checkAndNotify(requestId, height);
        })
      );
    })
  );
}

async function getASReceiverList(data_request) {
  let nodeIdList;
  if (!data_request.as_id_list || data_request.as_id_list.length === 0) {
    const asNodes = await common.getAsNodesByServiceId({
      service_id: data_request.service_id,
    });
    nodeIdList = asNodes.map((asNode) => asNode.id);
  } else {
    nodeIdList = data_request.as_id_list;
  }

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
        privateProofObjectList: requestData.privateProofObjectList,
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
  const idpNodes = await common.getIdpNodes({
    namespace,
    identifier,
    min_ial,
    min_aal,
  });

  let filteredIdpNodes;
  if (idp_list != null && idp_list.length !== 0) {
    filteredIdpNodes = idpNodes.filter(
      (idpNode) => idp_list.indexOf(idpNode.id) >= 0
    );
  } else {
    filteredIdpNodes = idpNodes;
  }

  const receivers = await Promise.all(
    filteredIdpNodes.map(async (idpNode) => {
      const nodeId = idpNode.id;
      const { ip, port } = await common.getMsqAddress(nodeId);
      return {
        ip,
        port,
        ...(await common.getNodePubKey(nodeId)),
      };
    })
  );
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

    let challenge = utils.randomBase64Bytes(config.challengeLength);
    db.setChallengeFromRequestId(request_id, challenge);

    const requestData = {
      namespace,
      identifier,
      request_id,
      min_idp,
      min_aal,
      min_ial,
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
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list: dataRequestListToBlockchain,
      message_hash: utils.hash(challenge + request_message),
    };

    // maintain mapping
    await db.setRequestIdByReferenceId(reference_id, request_id);
    await db.setRequestCallbackUrl(request_id, callback_url);

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

  const dataJSON = JSON.parse(data);

  //distinguish between message from idp, as
  if (dataJSON.idp_id != null) {
    //store private parameter from EACH idp to request, to pass along to as
    let request = await db.getRequestToSendToAS(dataJSON.request_id);
    //AS involve
    if (request) {
      if (request.privateProofObjectList) {
        request.privateProofObjectList.push({
          idp_id: dataJSON.idp_id,
          privateProofObject: {
            privateProofValue: dataJSON.privateProofValue,
            accessor_id: dataJSON.accessor_id,
          },
        });
      } else {
        request.privateProofObjectList = [
          {
            idp_id: dataJSON.idp_id,
            privateProofObject: {
              privateProofValue: dataJSON.privateProofValue,
              accessor_id: dataJSON.accessor_id,
            },
          },
        ];
      }
      await db.setRequestToSendToAS(dataJSON.request_id, request);
    }

    //must wait for height
    const latestBlockHeight = tendermint.latestBlockHeight;
    const responseId = dataJSON.request_id + ':' + dataJSON.idp_id;

    if (latestBlockHeight <= dataJSON.height) {
      logger.debug({
        message: 'Saving message from MQ',
        tendermintLatestBlockHeight: latestBlockHeight,
        messageBlockHeight: dataJSON.height,
      });
      db.setProofReceivedFromMQ(responseId, dataJSON);
      db.setExpectedIdpResponseNodeId(dataJSON.request_id, dataJSON.idp_id);
      return;
    }

    const callbackUrl = await db.getRequestCallbackUrl(dataJSON.request_id);
    // if (!callbackUrl) return;

    const requestDetail = await common.getRequestDetail({
      requestId: dataJSON.request_id,
    });

    if (requestDetail.responses == null) {
      requestDetail.responses = [];
    }

    checkZKAndNotify(
      requestDetail,
      latestBlockHeight,
      dataJSON.idp_id,
      callbackUrl,
      dataJSON
    );
  } else if (dataJSON.as_id != null) {
    //receive data from AS
    // TODO: verifies signature of AS in blockchain.
    // Call callback to RP.

    try {
      const requestDetail = await common.getRequestDetail({
        requestId: dataJSON.request_id,
      });
      // Note: Should check if received request id is expected?

      // Should check? (legal liability issue)
      // Check if AS signs sent data before request is closed or timed out
      // for (let i = 0; i < requestDetail.data_request_list.length; i++) {
      //   const dataRequest = requestDetail.data_request_list[i];
      //   if (dataRequest.answered_as_id_list.indexOf(dataJSON.as_id) < 0){
      //     return;
      //   }
      // }

      await db.addDataFromAS(dataJSON.request_id, {
        data: dataJSON.data,
        as_id: dataJSON.as_id,
      });
    } catch (error) {
      // TODO: error handling
      throw error;
    }
  }
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
    privateProofObject,
  });

  //query accessor_group_id of this accessor_id
  let accessor_group_id = await common.getAccessorGroupId(
    privateProofObject.accessor_id
  );
  let {
    namespace,
    identifier,
    privateProofObjectList,
    request_message,
  } = await db.getRequestToSendToAS(request_id);

  logger.debug({
    message: 'RP verifying zk proof',
    privateProofObjectList,
  });

  //and check against all accessor_group_id of responses
  for (let i = 0; i < privateProofObjectList.length; i++) {
    let otherPrivateProofObject = privateProofObjectList[i].privateProofObject;
    let otherGroupId = await common.getAccessorGroupId(
      otherPrivateProofObject.accessor_id
    );
    if (otherGroupId !== accessor_group_id) {
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
  let publicProof, signature, privateProofValueHash;
  let responses = (await common.getRequestDetail({
    requestId: request_id,
  })).responses;

  logger.debug({
    message: 'Request detail',
    responses,
    request_message,
  });

  responses.forEach((response) => {
    if (response.idp_id === idp_id) {
      publicProof = response.identity_proof;
      signature = response.signature;
      privateProofValueHash = response.private_proof_hash;
    }
  });

  let signatureValid = utils.verifySignature(
    signature,
    public_key,
    request_message
  );

  logger.debug({
    message: 'Verify signature',
    signatureValid,
    request_message,
    public_key,
    signature,
  });

  return (
    signatureValid &&
    utils.verifyZKProof(
      public_key,
      challenge,
      privateProofObject.privateProofValue,
      publicProof,
      {
        namespace,
        identifier,
      },
      privateProofValueHash,
    )
  );
}
