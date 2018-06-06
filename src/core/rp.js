import fetch from 'node-fetch';

import CustomError from '../error/customError';
import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as mq from '../mq';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';

let timeoutScheduler = common.timeoutScheduler;

/**
 *
 * @param {string} callbackUrl
 * @param {Object} data
 * @param {boolean} retry
 */
async function callbackToClient(callbackUrl, data, retry) {
  // TODO: retry with back-off, persistence
  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    logger.error({
      message: 'Cannot send callback to client application',
      error,
    });

    // TODO: error handling
    // retry?
  }
}

/**
 * 
 * @param {string} requestId 
 * @param {integer} height 
 */
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
    requestDetail.closed === false &&
    requestDetail.timed_out === false
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
    closed: requestDetail.closed,
    timed_out: requestDetail.timed_out,
    service_list: requestDetail.data_request_list.map((service) => ({
      service_id: service.service_id,
      count: service.count,
      answered_count:
        service.answered_as_id_list != null
          ? service.answered_as_id_list.length
          : 0,
    })),
  };

  await callbackToClient(callbackUrl, eventDataForCallback, true);

  if (
    // request.status === 'completed' ||
    requestDetail.status === 'rejected' ||
    requestDetail.closed ||
    requestDetail.timed_out
  ) {
    // Clean up
    // Clear callback url mapping, reference ID mapping, and request data to send to AS
    // since the request is no longer going to have further events
    // (the request has reached its end state)
    db.removeRequestCallbackUrl(requestId);
    db.removeRequestIdReferenceIdMappingByRequestId(requestId);
    db.removeRequestToSendToAS(requestId);
    db.removeTimeoutScheduler(requestId);
    common.clearTimeout(timeoutScheduler[requestId]);
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
  const responseValid = await common.verifyZKProof(
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
    closed: requestDetail.closed,
    timed_out: requestDetail.timed_out,
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

  await callbackToClient(callbackUrl, eventDataForCallback, true);

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
        source_node_id: dataJSON.as_id,
        service_id: dataJSON.service_id,
        source_signature: dataJSON.signature,
        data: dataJSON.data,
      });

      const asTotalCount = requestDetail.data_request_list.reduce(
        (total, service) => total + service.count,
        0
      );

      const receivedDataCount = await db.countDataFromAS(dataJSON.request_id);

      const received_all = asTotalCount === receivedDataCount;

      const callbackUrl = await db.getRequestCallbackUrl(dataJSON.request_id);

      const dataForCallback = {
        type: 'data_received',
        request_id: dataJSON.request_id,
        service_id: dataJSON.service_id,
        source_node_id: dataJSON.as_id,
        received_all,
      };

      await callbackToClient(callbackUrl, dataForCallback, true);
    } catch (error) {
      // TODO: error handling
      throw error;
    }
  }
}

export async function init() {
  let scheduler = await db.getAllTimeoutScheduler();
  scheduler.forEach(({ requestId, unixTimeout }) => {
    common.runTimeoutScheduler(requestId, (unixTimeout - Date.now()) / 1000);
  });

  //In production this should be done only once in phase 1,

  // Wait for blockchain ready
  await tendermint.ready;

  common.registerMsqAddress(config.mqRegister);
}
