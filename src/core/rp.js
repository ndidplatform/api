import fs from 'fs';
import path from 'path';

import { callbackToClient } from '../utils/callback';
import CustomError from '../error/customError';
import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as mq from '../mq';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';
import * as utils from '../utils';

import * as externalCryptoService from '../utils/externalCryptoService';

const callbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  __dirname,
  '..',
  '..',
  'rp-callback-url-' + config.nodeId,
);

[{ key: 'error_url', fileSuffix: 'error' }].forEach(({ key, fileSuffix }) => {
  try {
    callbackUrls[key] = fs.readFileSync(
      callbackUrlFilesPrefix + '-' + fileSuffix,
      'utf8'
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn({
        message: `${fileSuffix} callback url file not found`,
      });
    } else {
      logger.error({
        message: `Cannot read ${fileSuffix} callback url file`,
        error,
      });
    }
  }
});

export const setCallbackUrls = ({ error_url }) => {
  if (error_url != null) {
    callbackUrls.error_url = error_url;
    fs.writeFile(callbackUrlFilesPrefix + '-error', error_url, (err) => {
      if (err) {
        logger.error({
          message: 'Cannot write error callback url file',
          error: err,
        });
      }
    });
  }
};

export const getCallbackUrls = () => {
  return callbackUrls;
};

/**
 *
 * @param {string} requestId
 * @param {integer} height
 */
async function notifyRequestUpdate(requestId, height) {
  // logger.debug({
  //   message: 'RP check zk proof and notify',
  //   requestId,
  // });

  const callbackUrl = await db.getRequestCallbackUrl(requestId);
  if (!callbackUrl) return; // This RP does not concern this request

  const requestDetail = await common.getRequestDetail({
    requestId: requestId,
  });

  const requestStatus = utils.getDetailedRequestStatus(requestDetail);

  // ZK Proof verification is needed only when got new response from IdP
  let needZKProofVerification = false;
  if (
    requestStatus.status !== 'pending' &&
    requestStatus.closed === false &&
    requestStatus.timed_out === false
  ) {
    if (requestStatus.answered_idp_count < requestStatus.min_idp) {
      needZKProofVerification = true;
    } else if (requestStatus.answered_idp_count === requestStatus.min_idp) {
      const asAnswerCount = requestStatus.service_list.reduce(
        (total, service) => total + service.signed_data_count,
        0
      );
      if (asAnswerCount === 0) {
        needZKProofVerification = true;
      }
    }
  }

  if (needZKProofVerification) {
    // Validate ZK Proof
    const idpNodeId = await db.getExpectedIdpResponseNodeId(requestId);

    if (idpNodeId == null) return;

    await checkZKAndNotify({
      requestStatus, 
      height, 
      idpId: idpNodeId, 
      callbackUrl,
      mode: requestDetail.mode,
    });
    return;
  }

  const eventDataForCallback = {
    type: 'request_status',
    ...requestStatus,
  };

  await callbackToClient(callbackUrl, eventDataForCallback, true);

  // NOTE: Since blockchain state changes so fast (in some environment, e.g. dev env) that 
  // getRequestDetail() cannot get the state for each event in time 
  // (in this case AS signs and RP tells )
  // making 'completed' status occurs more than 1 time 
  // hence, closeRequest() will be called more than once
  if (
    requestStatus.status === 'completed' &&
    !requestStatus.closed &&
    !requestStatus.timed_out
  ) {
    await closeRequest(requestId);
  }

  if (
    requestStatus.closed ||
    requestStatus.timed_out
  ) {
    // Clean up
    // Clear callback url mapping, reference ID mapping, and request data to send to AS
    // since the request is no longer going to have further events
    // (the request has reached its end state)
    db.removeRequestCallbackUrl(requestId);
    db.removeRequestIdReferenceIdMappingByRequestId(requestId);
    db.removeRequestToSendToAS(requestId);
    db.removeTimeoutScheduler(requestId);
    clearTimeout(common.timeoutScheduler[requestId]);
    delete common.timeoutScheduler[requestId];
  }
}

async function checkZKAndNotify({
  requestStatus,
  height,
  idpId,
  callbackUrl,
  requestData,
  mode,
}) {

  logger.debug({
    message: 'Check ZK Proof then notify',
    requestStatus,
    height,
    idpId,
    callbackUrl,
    requestData,
    mode,
  });

  const responseValid = await common.verifyZKProof(
    requestStatus.request_id,
    idpId,
    requestData,
    mode,
  );

  if (
    requestStatus.status === 'confirmed' &&
    requestStatus.answered_idp_count === requestStatus.min_idp &&
    responseValid
  ) {
    const requestData = await db.getRequestToSendToAS(requestStatus.request_id);
    if (requestData != null) {
      await sendRequestToAS(requestData, height);
    }
    db.removeChallengeFromRequestId(requestStatus.request_id);
  }

  const eventDataForCallback = {
    type: 'request_status',
    ...requestStatus,
    latest_idp_response_valid: responseValid,
  };

  await callbackToClient(callbackUrl, eventDataForCallback, true);

  db.removeProofReceivedFromMQ(`${requestStatus.request_id}:${idpId}`);
  db.removeExpectedIdpResponseNodeId(requestStatus.request_id);
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
      const transactions = tendermint.getTransactionListFromBlockQuery(block);
      await Promise.all(
        transactions.map(async (transaction) => {
          // TODO: clear key with smart-contract, eg. request_id or requestId
          const requestId =
            transaction.args.request_id || transaction.args.requestId; //derive from tx;
          if (requestId == null) return;
          const height = block.block.header.height;
          await notifyRequestUpdate(requestId, height);
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

export async function handleMessageFromQueue(messageStr) {
  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    messageStr,
  });

  const message = JSON.parse(messageStr);

  //distinguish between message from idp, as
  if (message.idp_id != null) {
    //check accessor_id, undefined means mode 1
    if(message.accessor_id) {
      //store private parameter from EACH idp to request, to pass along to as
      let request = await db.getRequestToSendToAS(message.request_id);
      //AS involve
      if (request) {
        if (request.privateProofObjectList) {
          request.privateProofObjectList.push({
            idp_id: message.idp_id,
            privateProofObject: {
              privateProofValue: message.privateProofValue,
              accessor_id: message.accessor_id,
              padding: message.padding,
            },
          });
        } else {
          request.privateProofObjectList = [
            {
              idp_id: message.idp_id,
              privateProofObject: {
                privateProofValue: message.privateProofValue,
                accessor_id: message.accessor_id,
                padding: message.padding,
              },
            },
          ];
        }
        await db.setRequestToSendToAS(message.request_id, request);
      }
    }

    //must wait for height
    const latestBlockHeight = tendermint.latestBlockHeight;
    const responseId = message.request_id + ':' + message.idp_id;

    if (latestBlockHeight <= message.height) {
      logger.debug({
        message: 'Saving message from MQ',
        tendermintLatestBlockHeight: latestBlockHeight,
        messageBlockHeight: message.height,
      });
      db.setProofReceivedFromMQ(responseId, message);
      db.setExpectedIdpResponseNodeId(message.request_id, message.idp_id);
      return;
    }

    const callbackUrl = await db.getRequestCallbackUrl(message.request_id);
    // if (!callbackUrl) return;

    const requestDetail = await common.getRequestDetail({
      requestId: message.request_id,
    });

    const requestStatus = utils.getDetailedRequestStatus(requestDetail);

    checkZKAndNotify({
      requestStatus,
      height: latestBlockHeight,
      idpId: message.idp_id,
      callbackUrl,
      requestData: message,
      mode: message.accessor_id ? 3 : 1,
    });
  } else if (message.as_id != null) {
    //receive data from AS
    // TODO: verifies signature of AS in blockchain.
    // Call callback to RP.

    try {
      // const requestDetail = await common.getRequestDetail({
      //   requestId: dataJSON.request_id,
      // });
      // Note: Should check if received request id is expected?

      // Should check? (legal liability issue)
      // Check if AS signs sent data before request is closed or timed out
      // for (let i = 0; i < requestDetail.data_request_list.length; i++) {
      //   const dataRequest = requestDetail.data_request_list[i];
      //   if (dataRequest.answered_as_id_list.indexOf(dataJSON.as_id) < 0){
      //     return;
      //   }
      // }

      await db.addDataFromAS(message.request_id, {
        source_node_id: message.as_id,
        service_id: message.service_id,
        source_signature: message.signature,
        data: message.data,
      });

      await setDataReceived(message.request_id, message.service_id, message.as_id);
    } catch (error) {
      // TODO: error handling
      throw error;
    }
  }
}

async function setDataReceived(requestId, serviceId, asNodeId) {
  try {
    const result = await tendermint.transact(
      'SetDataReceived',
      {
        requestId,
        service_id: serviceId,
        as_id: asNodeId,
      },
      utils.getNonce()
    );
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot set data received to blockchain',
      requestId,
      serviceId,
      asNodeId,
      cause: error,
    });
  }
}

export async function closeRequest(requestId) {
  try {
    const result = await tendermint.transact(
      'CloseRequest',
      { requestId },
      utils.getNonce()
    );
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot close a request',
      requestId,
      cause: error,
    });
  }
}

export async function init() {
  // FIXME: In production this should be done only once. Hence, init() is not needed.

  // Wait for blockchain ready
  await tendermint.ready;

  if (config.useExternalCryptoService) {
    for (;;) {
      if (externalCryptoService.isCallbackUrlsSet()) {
        break;
      }
      await utils.wait(5000);
    }
  }

  common.registerMsqAddress(config.mqRegister);
}
