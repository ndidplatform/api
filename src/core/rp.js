/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 *
 * This file is part of NDID software.
 *
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 *
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 *
 * Please contact info@ndid.co.th for any further questions
 *
 */

import fs from 'fs';
import path from 'path';

import { callbackToClient } from '../utils/callback';
import CustomError from '../error/custom_error';
import logger from '../logger';

import * as tendermint from '../tendermint';
import * as tendermintNdid from '../tendermint/ndid';
import * as mq from '../mq';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';
import * as utils from '../utils';

const successBase64 = Buffer.from('success').toString('base64');
const trueBase64 = Buffer.from('true').toString('base64');

const idpResponseProcessLocks = {};
const challengeRequestProcessLocks = {};
const asDataResponseProcessLocks = {};

const callbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  config.dataDirectoryPath,
  'rp-callback-url-' + config.nodeId
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

function writeCallbackUrlToFile(fileSuffix, url) {
  fs.writeFile(callbackUrlFilesPrefix + '-' + fileSuffix, url, (err) => {
    if (err) {
      logger.error({
        message: `Cannot write ${fileSuffix} callback url file`,
        error: err,
      });
    }
  });
}

export function setCallbackUrls({ error_url }) {
  if (error_url != null) {
    callbackUrls.error_url = error_url;
    writeCallbackUrlToFile('error', error_url);
  }
}

export function getCallbackUrls() {
  return callbackUrls;
}

export function getErrorCallbackUrl() {
  return callbackUrls.error_url;
}

/**
 *
 * @param {string} requestId
 * @param {integer} height
 */
async function processRequestUpdate(requestId, height) {
  const callbackUrl = await db.getRequestCallbackUrl(requestId);
  if (!callbackUrl) return; // This RP does not concern this request

  logger.debug({
    message: 'Processing request update',
    requestId,
    height,
  });

  const requestDetail = await tendermintNdid.getRequestDetail({
    requestId: requestId,
    height,
  });

  const requestStatus = utils.getDetailedRequestStatus(requestDetail);

  // ZK Proof and IAL verification is needed only when got new response from IdP
  let needResponseVerification = false;
  if (
    requestStatus.status !== 'pending' &&
    requestStatus.closed === false &&
    requestStatus.timed_out === false
  ) {
    if (requestStatus.answered_idp_count < requestStatus.min_idp) {
      needResponseVerification = true;
    } else if (requestStatus.answered_idp_count === requestStatus.min_idp) {
      const asAnswerCount = requestStatus.service_list.reduce(
        (total, service) => total + service.signed_data_count,
        0
      );
      if (asAnswerCount === 0) {
        needResponseVerification = true;
      }
    }
  }

  const savedResponseValidList = await db.getIdpResponseValidList(requestId);
  let responseValidList;

  if (needResponseVerification) {
    // Validate ZK Proof and IAL
    const responseMetadataList = await db.getExpectedIdpResponseNodeIdInBlockList(
      height
    );
    const idpNodeIds = responseMetadataList
      .filter(({ requestId: reqId }) => requestId === reqId)
      .map((metadata) => metadata.idpId);

    let responseValids = await Promise.all(
      idpNodeIds.map((idpNodeId) => {
        const responseId = requestId + ':' + idpNodeId;
        if (idpResponseProcessLocks[responseId]) return;
        return common.checkIdpResponse({
          requestStatus,
          idpId: idpNodeId,
          responseIal: requestDetail.response_list.find(
            (response) => response.idp_id === idpNodeId
          ).ial,
        });
      })
    );
    responseValids = responseValids.filter((valid) => valid != null);

    if (responseValids.length === 0) return;

    responseValidList = savedResponseValidList.concat(responseValids);
  } else {
    responseValidList = savedResponseValidList;
  }

  const eventDataForCallback = {
    type: 'request_status',
    ...requestStatus,
    response_valid_list: responseValidList,
    block_height: height,
  };

  await callbackToClient(callbackUrl, eventDataForCallback, true);

  if (isAllIdpRespondedAndValid({ requestStatus, responseValidList })) {
    const requestData = await db.getRequestData(requestId);
    if (requestData != null) {
      await sendRequestToAS(requestData, height);
    }
    db.removeChallengeFromRequestId(requestId);
  }

  if (
    requestStatus.status === 'confirmed' &&
    requestStatus.min_idp === requestStatus.answered_idp_count &&
    requestStatus.service_list.length > 0
  ) {
    const metadataList = await db.getExpectedDataSignInBlockList(height);
    await checkAsDataSignaturesAndSetReceived(requestId, metadataList);
  }

  if (
    requestStatus.status === 'completed' &&
    !requestStatus.closed &&
    !requestStatus.timed_out &&
    (requestStatus.mode === 1 ||
      (requestStatus.mode === 3 && isAllIdpResponsesValid(responseValidList)))
  ) {
    logger.debug({
      message: 'Automatically closing request',
      requestId,
    });
    await common.closeRequest({ request_id: requestId }, { synchronous: true });
  }

  if (requestStatus.closed || requestStatus.timed_out) {
    // Clean up
    // Clear callback url mapping, reference ID mapping, and request data to send to AS
    // since the request is no longer going to have further events
    // (the request has reached its end state)
    db.removeRequestCallbackUrl(requestId);
    db.removeRequestIdReferenceIdMappingByRequestId(requestId);
    db.removeRequestData(requestId);
    db.removeIdpResponseValidList(requestId);
    db.removeTimeoutScheduler(requestId);
    clearTimeout(common.timeoutScheduler[requestId]);
    delete common.timeoutScheduler[requestId];
  }
}

function isAllIdpResponsesValid(responseValidList) {
  for (let i = 0; i < responseValidList.length; i++) {
    const { valid_proof, valid_ial } = responseValidList[i];
    if (valid_proof !== true || valid_ial !== true) {
      return false;
    }
  }
  return true;
}

function isAllIdpRespondedAndValid({ requestStatus, responseValidList }) {
  if (requestStatus.status !== 'confirmed') return false;
  if (requestStatus.answered_idp_count !== requestStatus.min_idp) return false;
  if (requestStatus.closed === true || requestStatus.timed_out === true)
    return false;
  const asAnswerCount = requestStatus.service_list.reduce(
    (total, service) => total + service.signed_data_count,
    0
  );
  if (asAnswerCount === 0) {
    // Send request to AS only when all IdP responses' proof and IAL are valid in mode 3
    if (
      requestStatus.mode === 1 ||
      (requestStatus.mode === 3 && isAllIdpResponsesValid(responseValidList))
    ) {
      return true;
    }
  }
  return false;
}

export async function handleTendermintNewBlockEvent(
  error,
  result,
  missingBlockCount
) {
  if (missingBlockCount == null) return;
  try {
    const height = tendermint.getBlockHeightFromNewBlockEvent(result);
    const fromHeight =
      missingBlockCount === 0 ? height - 1 : height - missingBlockCount;
    const toHeight = height - 1;

    //loop through all those block before, and verify all proof
    logger.debug({
      message: 'Getting request IDs to process',
      fromHeight,
      toHeight,
    });

    const challengeRequestMetadataList = await db.getExpectedIdpPublicProofInBlockList(
      fromHeight,
      toHeight
    );
    await Promise.all(
      challengeRequestMetadataList.map(async ({ requestId, idpId }) => {
        const responseId = requestId + ':' + idpId;
        if (challengeRequestProcessLocks[responseId]) return;
        const publicProof = await db.getPublicProofReceivedFromMQ(responseId);
        if (publicProof == null) return;
        await common.handleChallengeRequest({
          request_id: requestId,
          idp_id: idpId,
          public_proof: publicProof
        });
        await db.removePublicProofReceivedFromMQ(responseId);
      })
    );
    db.removeExpectedIdpPublicProofInBlockList(fromHeight, toHeight);

    const blocks = await tendermint.getBlocks(fromHeight, toHeight);
    await Promise.all(
      blocks.map(async (block, blockIndex) => {
        let transactions = tendermint.getTransactionListFromBlock(block);
        if (transactions.length === 0) return;

        let requestIdsToProcessUpdate = await Promise.all(
          transactions.map(async (transaction) => {
            // TODO: clear key with smart-contract, eg. request_id or requestId
            const requestId =
              transaction.args.request_id || transaction.args.requestId;
            if (requestId == null) return;
            if (transaction.fnName === 'DeclareIdentityProof') return;

            const callbackUrl = await db.getRequestCallbackUrl(requestId);
            if (!callbackUrl) return; // This request does not concern this RP

            return requestId;
          })
        );
        const requestIdsToProcessUpdateWithValue = requestIdsToProcessUpdate.filter(
          (requestId) => requestId != null
        );
        if (requestIdsToProcessUpdateWithValue.length === 0) return;

        const height = parseInt(block.header.height);
        const blockResults = await tendermint.getBlockResults(height, height);
        requestIdsToProcessUpdate = requestIdsToProcessUpdate.filter(
          (requestId, index) => {
            const deliverTxResult =
              blockResults[blockIndex].results.DeliverTx[index];
            const successTag = deliverTxResult.tags.find(
              (tag) => tag.key === successBase64
            );
            if (successTag) {
              return successTag.value === trueBase64;
            }
            return false;
          }
        );

        requestIdsToProcessUpdate = [...new Set(requestIdsToProcessUpdate)];

        await Promise.all(
          requestIdsToProcessUpdate.map((requestId) =>
            processRequestUpdate(requestId, height)
          )
        );
        db.removeExpectedIdpResponseNodeIdInBlockList(height);
        db.removeExpectedDataSignInBlockList(height);
      })
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling Tendermint NewBlock event',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      callbackUrl: callbackUrls.error_url,
      action: 'handleTendermintNewBlockEvent',
      error: err,
    });
  }
}

async function getASReceiverList(data_request) {
  let nodeIdList;
  if (!data_request.as_id_list || data_request.as_id_list.length === 0) {
    const asNodes = await tendermintNdid.getAsNodesByServiceId({
      service_id: data_request.service_id,
    });
    nodeIdList = asNodes.map((asNode) => asNode.node_id);
  } else {
    nodeIdList = data_request.as_id_list;
  }

  const receivers = (await Promise.all(
    nodeIdList.map(async (nodeId) => {
      try {
        //let nodeId = node.node_id;
        let mqAddress = await tendermintNdid.getMsqAddress(nodeId);
        if (!mqAddress) return null;
        let { ip, port } = mqAddress;
        return {
          node_id: nodeId,
          ip,
          port,
          ...(await tendermintNdid.getNodePubKey(nodeId)),
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
    message: 'Sending request to AS',
    requestData,
    height,
  });

  if (requestData.data_request_list == null) return;
  if (requestData.data_request_list.length === 0) return;

  const dataToSendByNodeId = {};
  await Promise.all(
    requestData.data_request_list.map(async (data_request) => {
      const receivers = await getASReceiverList(data_request);
      if (receivers.length === 0) {
        logger.error({
          message: 'No AS found',
          data_request,
        });
        return;
      }

      const serviceDataRequest = {
        service_id: data_request.service_id,
        request_params: data_request.request_params,
      };
      receivers.forEach((receiver) => {
        if (dataToSendByNodeId[receiver.node_id]) {
          dataToSendByNodeId[receiver.node_id].service_data_request_list.push(
            serviceDataRequest
          );
        } else {
          dataToSendByNodeId[receiver.node_id] = {
            receiver,
            service_data_request_list: [serviceDataRequest],
          };
        }
      });
    })
  );

  const challenge = await db.getChallengeFromRequestId(requestData.request_id);
  await Promise.all(
    Object.values(dataToSendByNodeId).map(
      ({ receiver, service_data_request_list }) =>
        mq.send([receiver], {
          type: 'data_request',
          request_id: requestData.request_id,
          mode: requestData.mode,
          namespace: requestData.namespace,
          identifier: requestData.identifier,
          service_data_request_list,
          rp_id: requestData.rp_id,
          request_message: requestData.request_message,
          challenge,
          secretSalt: requestData.secretSalt,
          privateProofObjectList: requestData.privateProofObjectList,
          height,
        })
    )
  );
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
    const request = await tendermintNdid.getRequest({ requestId });
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
  let requestId;
  try {
    const message = JSON.parse(messageStr);
    requestId = message.request_id;

    if (message.type === 'challenge_request') {
      const responseId = message.request_id + ':' + message.idp_id;
      const latestBlockHeight = tendermint.latestBlockHeight;
      if (latestBlockHeight <= message.height) {
        logger.debug({
          message: 'Saving expected public proof from MQ',
          responseId,
          public_proof: message.public_proof,
        });
        challengeRequestProcessLocks[responseId] = true;
        await Promise.all([
          db.setPublicProofReceivedFromMQ(responseId, message.public_proof),
          db.addExpectedIdpPublicProofInBlock(message.height, {
            requestId: message.request_id,
            idpId: message.idp_id,
          }),
        ]);
        if (tendermint.latestBlockHeight <= message.height) {
          delete challengeRequestProcessLocks[responseId];
          return;
        } else {
          await db.removePublicProofReceivedFromMQ(responseId);
        }
      }
      await common.handleChallengeRequest({ 
        request_id: message.request_id,
        idp_id: message.idp_id,
        public_proof: message.public_proof
      });
      delete challengeRequestProcessLocks[responseId];
    } else if (message.type === 'idp_response') {
      const callbackUrl = await db.getRequestCallbackUrl(message.request_id);
      if (!callbackUrl) return;

      //check accessor_id, undefined means mode 1
      if (message.accessor_id) {
        //store private parameter from EACH idp to request, to pass along to as
        const request = await db.getRequestData(message.request_id);
        //AS involve
        if (request) {
          if (request.privateProofObjectList) {
            request.privateProofObjectList.push({
              idp_id: message.idp_id,
              privateProofObject: {
                privateProofValue: message.privateProofValueArray,
                accessor_id: message.accessor_id,
                padding: message.padding,
              },
            });
          } else {
            request.privateProofObjectList = [
              {
                idp_id: message.idp_id,
                privateProofObject: {
                  privateProofValue: message.privateProofValueArray,
                  accessor_id: message.accessor_id,
                  padding: message.padding,
                },
              },
            ];
          }
          await db.setRequestData(message.request_id, request);
        }
      }

      const responseId = message.request_id + ':' + message.idp_id;
      //must wait for height
      const latestBlockHeight = tendermint.latestBlockHeight;
      if (latestBlockHeight <= message.height) {
        logger.debug({
          message: 'Saving message from MQ',
          tendermintLatestBlockHeight: latestBlockHeight,
          messageBlockHeight: message.height,
        });
        idpResponseProcessLocks[responseId] = true;
        await Promise.all([
          db.setPrivateProofReceivedFromMQ(responseId, message),
          db.addExpectedIdpResponseNodeIdInBlock(message.height, {
            requestId: message.request_id,
            idpId: message.idp_id,
          }),
        ]);
        if (tendermint.latestBlockHeight <= message.height) {
          delete idpResponseProcessLocks[responseId];
          return;
        } else {
          await db.removePrivateProofReceivedFromMQ(responseId);
        }
      }

      const requestDetail = await tendermintNdid.getRequestDetail({
        requestId: message.request_id,
        height: message.height,
      });

      const requestStatus = utils.getDetailedRequestStatus(requestDetail);

      const savedResponseValidList = await db.getIdpResponseValidList(
        message.request_id
      );

      const responseValid = await common.checkIdpResponse({
        requestStatus,
        idpId: message.idp_id,
        requestDataFromMq: message,
        responseIal: requestDetail.response_list.find(
          (response) => response.idp_id === message.idp_id
        ).ial,
      });

      const responseValidList = savedResponseValidList.concat([responseValid]);

      const eventDataForCallback = {
        type: 'request_status',
        ...requestStatus,
        response_valid_list: responseValidList,
        block_height: message.height,
      };

      await callbackToClient(callbackUrl, eventDataForCallback, true);

      if (isAllIdpRespondedAndValid({ requestStatus, responseValidList })) {
        const requestData = await db.getRequestData(message.request_id);
        if (requestData != null) {
          await sendRequestToAS(requestData, message.height);
        }
        db.removeChallengeFromRequestId(message.request_id);
      }

      if (
        requestStatus.status === 'completed' &&
        !requestStatus.closed &&
        !requestStatus.timed_out &&
        (requestStatus.mode === 1 ||
          (requestStatus.mode === 3 &&
            isAllIdpResponsesValid(responseValidList)))
      ) {
        logger.debug({
          message: 'Automatically closing request',
          requestId: message.request_id,
        });
        await common.closeRequest(
          { request_id: message.request_id },
          { synchronous: true }
        );
      }
      delete idpResponseProcessLocks[responseId];
    } else if (message.type === 'as_data_response') {
      // Receive data from AS
      await db.addDataFromAS(message.request_id, {
        source_node_id: message.as_id,
        service_id: message.service_id,
        source_signature: message.signature,
        data: message.data,
      });

      const asResponseId =
        message.request_id + ':' + message.service_id + ':' + message.as_id;
      const latestBlockHeight = tendermint.latestBlockHeight;
      if (latestBlockHeight <= message.height) {
        logger.debug({
          message: 'Saving expected data signature',
          tendermintLatestBlockHeight: latestBlockHeight,
          messageBlockHeight: message.height,
        });
        asDataResponseProcessLocks[asResponseId] = true;
        await db.addExpectedDataSignInBlock(message.height, {
          requestId: message.request_id,
          serviceId: message.service_id,
          asId: message.as_id,
        });
        if (tendermint.latestBlockHeight <= message.height) {
          delete asDataResponseProcessLocks[asResponseId];
          return;
        }
      }
      await processAsData({
        requestId: message.request_id,
        serviceId: message.service_id,
        nodeId: message.as_id,
        signature: message.signature,
        data: message.data,
      });
      delete asDataResponseProcessLocks[asResponseId];
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling message from message queue',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      callbackUrl: callbackUrls.error_url,
      action: 'handleMessageFromQueue',
      error: err,
      requestId,
    });
  }
}

async function isDataSignatureValid(asNodeId, signature, data) {
  const publicKeyObj = await tendermintNdid.getNodePubKey(asNodeId);
  if (publicKeyObj == null) return;
  if (publicKeyObj.public_key == null) return;

  logger.debug({
    message: 'Verifying AS data signature',
    asNodeId,
    asNodePublicKey: publicKeyObj.public_key,
    signature,
    data,
  });
  if (
    !utils.verifySignature(
      signature,
      publicKeyObj.public_key,
      JSON.stringify(data)
    )
  ) {
    logger.warn({
      message: 'Data signature from AS is not valid',
      signature,
      asNodeId,
      asNodePublicKey: publicKeyObj.public_key,
    });
    return false;
  }
  return true;
}

async function checkAsDataSignaturesAndSetReceived(requestId, metadataList) {
  logger.debug({
    message: 'Check AS data signatures and set received (bulk)',
    requestId,
    metadataList,
  });

  const dataFromAS = await db.getDatafromAS(requestId);

  await Promise.all(
    metadataList.map(async ({ requestId, serviceId, asId }) => {
      const asResponseId = requestId + ':' + serviceId + ':' + asId;
      if (asDataResponseProcessLocks[asResponseId]) return;
      const data = dataFromAS.find(
        (data) => data.service_id === serviceId && data.source_node_id === asId
      );
      if (data == null) return; // Have not received data from AS through message queue yet
      await processAsData({
        requestId,
        serviceId,
        nodeId: asId,
        signature: data.source_signature,
        data: data.data,
      });
    })
  );
}

async function processAsData({
  requestId,
  serviceId,
  nodeId,
  signature,
  data,
}) {
  logger.debug({
    message: 'Processing AS data response',
    requestId,
    serviceId,
    nodeId,
    signature,
    data,
  });

  const signatureFromBlockchain = await tendermintNdid.getDataSignature({
    request_id: requestId,
    service_id: serviceId,
    node_id: nodeId,
  });

  if (signatureFromBlockchain == null) return;
  // TODO: if signature is invalid or mismatch then delete data from cache
  if (signature !== signatureFromBlockchain) return;
  if (!(await isDataSignatureValid(nodeId, signatureFromBlockchain, data))) {
    return;
  }

  await tendermintNdid.setDataReceived({
    requestId,
    service_id: serviceId,
    as_id: nodeId,
  });
}
