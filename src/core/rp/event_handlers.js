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

import {
  callbackUrls,
  isAllIdpResponsesValid,
  isAllIdpRespondedAndValid,
  sendRequestToAS,
} from '.';

import { callbackToClient } from '../../utils/callback';
import CustomError from '../../error/custom_error';
import logger from '../../logger';

import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import * as longTermDb from '../../db/long_term';
import * as utils from '../../utils';
import privateMessageType from '../private_message_type';

const successBase64 = Buffer.from('success').toString('base64');
const trueBase64 = Buffer.from('true').toString('base64');

const challengeRequestProcessLocks = {};
const idpResponseProcessLocks = {};
const asDataResponseProcessLocks = {};

export async function handleMessageFromQueue(messageStr) {
  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    messageStr,
  });
  // TODO: validate message schema

  let requestId;
  try {
    const message = JSON.parse(messageStr);
    requestId = message.request_id;

    await longTermDb.addMessage(message.type, requestId, messageStr);

    if (message.type === privateMessageType.CHALLENGE_REQUEST) {
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
          cacheDb.setPublicProofReceivedFromMQ(responseId, message.public_proof),
          cacheDb.addExpectedIdpPublicProofInBlock(message.height, {
            requestId: message.request_id,
            idpId: message.idp_id,
          }),
        ]);
        if (tendermint.latestBlockHeight <= message.height) {
          delete challengeRequestProcessLocks[responseId];
          return;
        } else {
          await cacheDb.removePublicProofReceivedFromMQ(responseId);
        }
      }
      await common.handleChallengeRequest({
        request_id: message.request_id,
        idp_id: message.idp_id,
        public_proof: message.public_proof,
      });
      delete challengeRequestProcessLocks[responseId];
    } else if (message.type === privateMessageType.IDP_RESPONSE) {
      const callbackUrl = await cacheDb.getRequestCallbackUrl(message.request_id);
      if (!callbackUrl) return;

      //check accessor_id, undefined means mode 1
      if (message.accessor_id) {
        //store private parameter from EACH idp to request, to pass along to as
        const request = await cacheDb.getRequestData(message.request_id);
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
          await cacheDb.setRequestData(message.request_id, request);
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
          cacheDb.setPrivateProofReceivedFromMQ(responseId, message),
          cacheDb.addExpectedIdpResponseNodeIdInBlock(message.height, {
            requestId: message.request_id,
            idpId: message.idp_id,
          }),
        ]);
        if (tendermint.latestBlockHeight <= message.height) {
          delete idpResponseProcessLocks[responseId];
          return;
        } else {
          await cacheDb.removePrivateProofReceivedFromMQ(responseId);
        }
      }

      const requestDetail = await tendermintNdid.getRequestDetail({
        requestId: message.request_id,
        height: message.height,
      });

      const requestStatus = utils.getDetailedRequestStatus(requestDetail);

      const savedResponseValidList = await cacheDb.getIdpResponseValidList(
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
        const requestData = await cacheDb.getRequestData(message.request_id);
        if (requestData != null) {
          await sendRequestToAS(requestData, message.height);
        }
        cacheDb.removeChallengeFromRequestId(message.request_id);
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
    } else if (message.type === privateMessageType.AS_DATA_RESPONSE) {
      // Receive data from AS
      await cacheDb.addDataFromAS(message.request_id, {
        source_node_id: message.as_id,
        service_id: message.service_id,
        source_signature: message.signature,
        signature_sign_method: 'RSA-SHA256',
        data_salt: message.data_salt,
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
        await cacheDb.addExpectedDataSignInBlock(message.height, {
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
        dataSalt: message.data_salt,
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

export async function handleTendermintNewBlockEvent(
  error,
  result,
  missingBlockCount
) {
  if (missingBlockCount == null) return;
  try {
    const height = tendermint.getBlockHeightFromNewBlockEvent(result);
    const fromHeight = height - 1 - missingBlockCount;
    const toHeight = height - 1;

    //loop through all those block before, and verify all proof
    logger.debug({
      message: 'Getting request IDs to process',
      fromHeight,
      toHeight,
    });

    const challengeRequestMetadataList = await cacheDb.getExpectedIdpPublicProofInBlockList(
      fromHeight,
      toHeight
    );
    await Promise.all(
      challengeRequestMetadataList.map(async ({ requestId, idpId }) => {
        const responseId = requestId + ':' + idpId;
        if (challengeRequestProcessLocks[responseId]) return;
        const publicProof = await cacheDb.getPublicProofReceivedFromMQ(responseId);
        if (publicProof == null) return;
        await common.handleChallengeRequest({
          request_id: requestId,
          idp_id: idpId,
          public_proof: publicProof,
        });
        await cacheDb.removePublicProofReceivedFromMQ(responseId);
      })
    );
    cacheDb.removeExpectedIdpPublicProofInBlockList(fromHeight, toHeight);

    const blocks = await tendermint.getBlocks(fromHeight, toHeight);
    await Promise.all(
      blocks.map(async (block, blockIndex) => {
        let transactions = tendermint.getTransactionListFromBlock(block);
        if (transactions.length === 0) return;

        let requestIdsToProcessUpdate = await Promise.all(
          transactions.map(async (transaction) => {
            const requestId = transaction.args.request_id;
            if (requestId == null) return;
            if (transaction.fnName === 'DeclareIdentityProof') return;

            const callbackUrl = await cacheDb.getRequestCallbackUrl(requestId);
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
        cacheDb.removeExpectedIdpResponseNodeIdInBlockList(height);
        cacheDb.removeExpectedDataSignInBlockList(height);
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

/**
 *
 * @param {string} requestId
 * @param {integer} height
 */
async function processRequestUpdate(requestId, height) {
  const callbackUrl = await cacheDb.getRequestCallbackUrl(requestId);
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

  const savedResponseValidList = await cacheDb.getIdpResponseValidList(requestId);
  let responseValidList;

  if (needResponseVerification) {
    // Validate ZK Proof and IAL
    const responseMetadataList = await cacheDb.getExpectedIdpResponseNodeIdInBlockList(
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
    const requestData = await cacheDb.getRequestData(requestId);
    if (requestData != null) {
      await sendRequestToAS(requestData, height);
    }
    cacheDb.removeChallengeFromRequestId(requestId);
  }

  if (
    requestStatus.status === 'confirmed' &&
    requestStatus.min_idp === requestStatus.answered_idp_count &&
    requestStatus.service_list.length > 0
  ) {
    const metadataList = await cacheDb.getExpectedDataSignInBlockList(height);
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
    await Promise.all([
      cacheDb.removeRequestCallbackUrl(requestId),
      cacheDb.removeRequestIdReferenceIdMappingByRequestId(requestId),
      cacheDb.removeRequestData(requestId),
      cacheDb.removeIdpResponseValidList(requestId),
      common.removeTimeoutScheduler(requestId),
    ]);
  }
}

async function checkAsDataSignaturesAndSetReceived(requestId, metadataList) {
  logger.debug({
    message: 'Check AS data signatures and set received (bulk)',
    requestId,
    metadataList,
  });

  const dataFromAS = await cacheDb.getDatafromAS(requestId);

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
        dataSalt: data.data_salt,
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
  dataSalt,
  data,
}) {
  logger.debug({
    message: 'Processing AS data response',
    requestId,
    serviceId,
    nodeId,
    signature,
    dataSalt,
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
  if (
    !(await isDataSignatureValid(
      nodeId,
      signatureFromBlockchain,
      dataSalt,
      data
    ))
  ) {
    return;
  }

  await tendermintNdid.setDataReceived({
    requestId,
    service_id: serviceId,
    as_id: nodeId,
  });
}

async function isDataSignatureValid(asNodeId, signature, salt, data) {
  const publicKeyObj = await tendermintNdid.getNodePubKey(asNodeId);
  if (publicKeyObj == null) return;
  if (publicKeyObj.public_key == null) return;

  logger.debug({
    message: 'Verifying AS data signature',
    asNodeId,
    asNodePublicKey: publicKeyObj.public_key,
    signature,
    salt,
    data,
  });
  if (!utils.verifySignature(signature, publicKeyObj.public_key, data + salt)) {
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
