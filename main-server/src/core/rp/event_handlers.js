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
  processAsData,
} from '.';

import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../../mq/message/type';
import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';
import CustomError from 'ndid-error/custom_error';
import logger from '../../logger';

import * as config from '../../config';

const challengeRequestProcessLocks = {};
const idpResponseProcessLocks = {};
const asDataResponseProcessLocks = {};

export async function handleMessageFromQueue(message, nodeId = config.nodeId) {
  logger.info({
    message: 'Received message from MQ',
    nodeId,
  });
  logger.debug({
    message: 'Message from MQ',
    messageJSON: message,
  });

  const requestId = message.request_id;
  try {
    if (message.type === privateMessageType.CHALLENGE_REQUEST) {
      const responseId =
        nodeId + ':' + message.request_id + ':' + message.idp_id;
      const latestBlockHeight = tendermint.latestBlockHeight;
      if (latestBlockHeight <= message.height) {
        logger.debug({
          message: 'Saving expected public proof from MQ',
          responseId,
          public_proof: message.public_proof,
        });
        challengeRequestProcessLocks[responseId] = true;
        await Promise.all([
          cacheDb.setPublicProofReceivedFromMQ(
            nodeId,
            responseId,
            message.public_proof
          ),
          cacheDb.addExpectedIdpPublicProofInBlock(nodeId, message.height, {
            requestId: message.request_id,
            idpId: message.idp_id,
          }),
        ]);
        if (tendermint.latestBlockHeight <= message.height) {
          delete challengeRequestProcessLocks[responseId];
          return;
        } else {
          await cacheDb.removePublicProofReceivedFromMQ(nodeId, responseId);
        }
      }
      await common.handleChallengeRequest({
        nodeId,
        request_id: message.request_id,
        idp_id: message.idp_id,
        public_proof: message.public_proof,
      });
      delete challengeRequestProcessLocks[responseId];
    } else if (message.type === privateMessageType.IDP_RESPONSE) {
      const requestData = await cacheDb.getRequestData(
        nodeId,
        message.request_id
      );
      if (requestData == null) return;

      // "accessor_id" and private proof are present only in mode 3
      if (message.mode === 3) {
        //store private parameter from EACH idp to request, to pass along to as
        const request = await cacheDb.getRequestData(
          nodeId,
          message.request_id
        );
        //AS involve
        if (request != null) {
          await cacheDb.addPrivateProofObjectInRequest(
            nodeId,
            message.request_id,
            {
              idp_id: message.idp_id,
              privateProofObject: {
                privateProofValue: message.privateProofValueArray,
                accessor_id: message.accessor_id,
                padding: message.padding,
              },
            }
          );
        }
      }

      const responseId =
        nodeId + ':' + message.request_id + ':' + message.idp_id;
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
          cacheDb.setPrivateProofReceivedFromMQ(nodeId, responseId, message),
          cacheDb.addExpectedIdpResponseNodeIdInBlock(nodeId, message.height, {
            requestId: message.request_id,
            idpId: message.idp_id,
          }),
        ]);
        if (tendermint.latestBlockHeight <= message.height) {
          delete idpResponseProcessLocks[responseId];
          return;
        } else {
          await cacheDb.removePrivateProofReceivedFromMQ(nodeId, responseId);
        }
      }

      const requestDetail = await tendermintNdid.getRequestDetail({
        requestId: message.request_id,
        height: message.height,
      });

      const requestStatus = utils.getDetailedRequestStatus(requestDetail);

      const savedResponseValidList = await cacheDb.getIdpResponseValidList(
        nodeId,
        message.request_id
      );

      const responseValid = await common.checkIdpResponse({
        nodeId,
        requestStatus,
        idpId: message.idp_id,
        requestDataFromMq: message,
        responseIal: requestDetail.response_list.find(
          (response) => response.idp_id === message.idp_id
        ).ial,
      });

      const responseValidList = savedResponseValidList.concat([responseValid]);

      const eventDataForCallback = {
        node_id: nodeId,
        type: 'request_status',
        ...requestStatus,
        response_valid_list: responseValidList,
        block_height: `${requestDetail.creation_chain_id}:${message.height}`,
      };

      const callbackUrl = requestData.callback_url;
      await callbackToClient(callbackUrl, eventDataForCallback, true);

      if (isAllIdpRespondedAndValid({ requestStatus, responseValidList })) {
        const requestData = await cacheDb.getRequestData(
          nodeId,
          message.request_id
        );
        if (requestData != null) {
          await sendRequestToAS(nodeId, requestData, message.height);
        }
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
          { node_id: nodeId, request_id: message.request_id },
          {
            synchronous: false,
            sendCallbackToClient: false,
            saveForRetryOnChainDisabled: true,
          }
        );
      }
      delete idpResponseProcessLocks[responseId];
    } else if (message.type === privateMessageType.AS_DATA_RESPONSE) {
      // Receive data from AS
      const asResponseId =
        nodeId +
        ':' +
        message.request_id +
        ':' +
        message.service_id +
        ':' +
        message.as_id;
      await cacheDb.setDataResponseFromAS(nodeId, asResponseId, message);

      const latestBlockHeight = tendermint.latestBlockHeight;
      if (latestBlockHeight <= message.height) {
        logger.debug({
          message: 'Saving expected data signature',
          tendermintLatestBlockHeight: latestBlockHeight,
          messageBlockHeight: message.height,
        });
        asDataResponseProcessLocks[asResponseId] = true;
        await cacheDb.addExpectedDataSignInBlock(nodeId, message.height, {
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
        nodeId,
        requestId: message.request_id,
        serviceId: message.service_id,
        asNodeId: message.as_id,
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
      nodeId,
      callbackUrl: callbackUrls.error_url,
      action: 'handleMessageFromQueue',
      error: err,
      requestId,
    });
  }
}

export async function handleTendermintNewBlock(
  fromHeight,
  toHeight,
  parsedTransactionsInBlocks,
  nodeId = config.nodeId
) {
  logger.debug({
    message: 'Handling Tendermint new blocks',
    nodeId,
    fromHeight,
    toHeight,
  });

  try {
    await Promise.all([
      processChallengeRequestExpectedInBlocks(fromHeight, toHeight, nodeId),
      processASDataSignExpectedInBlocks(fromHeight, toHeight, nodeId),
      processTasksInBlocks(parsedTransactionsInBlocks, nodeId),
    ]);
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling Tendermint NewBlock event',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      nodeId,
      callbackUrl: callbackUrls.error_url,
      action: 'handleTendermintNewBlock',
      error: err,
    });
  }
}

async function processChallengeRequestExpectedInBlocks(
  fromHeight,
  toHeight,
  nodeId
) {
  const challengeRequestMetadataList = await cacheDb.getExpectedIdpPublicProofInBlockList(
    nodeId,
    fromHeight,
    toHeight
  );
  await Promise.all(
    challengeRequestMetadataList.map(async ({ requestId, idpId }) => {
      const responseId = nodeId + ':' + requestId + ':' + idpId;
      if (challengeRequestProcessLocks[responseId]) return;
      const publicProof = await cacheDb.getPublicProofReceivedFromMQ(
        nodeId,
        responseId
      );
      if (publicProof == null) return;
      await common.handleChallengeRequest({
        nodeId,
        request_id: requestId,
        idp_id: idpId,
        public_proof: publicProof,
      });
      await cacheDb.removePublicProofReceivedFromMQ(nodeId, responseId);
    })
  );
  cacheDb.removeExpectedIdpPublicProofInBlockList(nodeId, fromHeight, toHeight);
}

async function processASDataSignExpectedInBlocks(fromHeight, toHeight, nodeId) {
  const metadataList = await cacheDb.getExpectedDataSignsInBlockList(
    nodeId,
    fromHeight,
    toHeight
  );
  await checkAsDataSignaturesAndSetReceived(nodeId, metadataList);
  cacheDb.removeExpectedDataSignsInBlockList(nodeId, fromHeight, toHeight);
}

async function processTasksInBlocks(parsedTransactionsInBlocks, nodeId) {
  await Promise.all(
    parsedTransactionsInBlocks.map(async ({ height, transactions }) => {
      const requestIdsToProcessUpdateSet = new Set();
      transactions.forEach((transaction) => {
        const requestId = transaction.args.request_id;
        if (requestId == null) return;
        if (transaction.fnName === 'DeclareIdentityProof') return;
        requestIdsToProcessUpdateSet.add(requestId);
      });
      const requestIdsToProcessUpdate = [...requestIdsToProcessUpdateSet];

      await Promise.all(
        requestIdsToProcessUpdate.map((requestId) =>
          processRequestUpdate(nodeId, requestId, height)
        )
      );
      cacheDb.removeExpectedIdpResponseNodeIdInBlockList(nodeId, height);
    })
  );
}

/**
 *
 * @param {string} requestId
 * @param {integer} height
 */
async function processRequestUpdate(nodeId, requestId, height) {
  const requestData = await cacheDb.getRequestData(nodeId, requestId);
  if (requestData == null) return; // This RP does not concern this request

  logger.debug({
    message: 'Processing request update',
    nodeId,
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

  const savedResponseValidList = await cacheDb.getIdpResponseValidList(
    nodeId,
    requestId
  );
  let responseValidList;

  if (needResponseVerification) {
    // Validate ZK Proof and IAL
    const responseMetadataList = await cacheDb.getExpectedIdpResponseNodeIdInBlockList(
      nodeId,
      height
    );
    const idpNodeIds = responseMetadataList
      .filter(({ requestId: reqId }) => requestId === reqId)
      .map((metadata) => metadata.idpId);

    let responseValids = await Promise.all(
      idpNodeIds.map((idpNodeId) => {
        const responseId = nodeId + ':' + requestId + ':' + idpNodeId;
        if (idpResponseProcessLocks[responseId]) return;
        return common.checkIdpResponse({
          nodeId,
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
    node_id: nodeId,
    type: 'request_status',
    ...requestStatus,
    response_valid_list: responseValidList,
    block_height: `${requestDetail.creation_chain_id}:${height}`,
  };

  const callbackUrl = requestData.callback_url;
  await callbackToClient(callbackUrl, eventDataForCallback, true);

  if (isAllIdpRespondedAndValid({ requestStatus, responseValidList })) {
    const requestData = await cacheDb.getRequestData(nodeId, requestId);
    if (requestData != null) {
      await sendRequestToAS(nodeId, requestData, height);
    }
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
    await common.closeRequest(
      { node_id: nodeId, request_id: requestId },
      {
        synchronous: false,
        sendCallbackToClient: false,
        saveForRetryOnChainDisabled: true,
      }
    );
  }

  if (requestStatus.closed || requestStatus.timed_out) {
    // Clean up
    // Clear callback url mapping, reference ID mapping, and request data to send to AS
    // since the request is no longer going to have further events
    // (the request has reached its end state)
    const requestData = await cacheDb.getRequestData(nodeId, requestId);
    const referenceId = requestData.reference_id;
    await Promise.all([
      cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
      cacheDb.removeRequestData(nodeId, requestId),
      cacheDb.removePrivateProofObjectListInRequest(nodeId, requestId),
      cacheDb.removeIdpResponseValidList(nodeId, requestId),
      cacheDb.removeRequestCreationMetadata(nodeId, requestId),
    ]);
  }
}

async function checkAsDataSignaturesAndSetReceived(nodeId, metadataList) {
  logger.debug({
    message: 'Check AS data signatures and set received (bulk)',
    nodeId,
    metadataList,
  });

  await Promise.all(
    metadataList.map(async ({ requestId, serviceId, asId }) => {
      const asResponseId =
        nodeId + ':' + requestId + ':' + serviceId + ':' + asId;
      if (asDataResponseProcessLocks[asResponseId]) return;
      const dataResponseFromAS = await cacheDb.getDataResponsefromAS(
        nodeId,
        asResponseId
      );
      if (dataResponseFromAS == null) return; // Have not received data from AS through message queue yet
      await processAsData({
        nodeId,
        requestId,
        serviceId,
        asNodeId: asId,
        signature: dataResponseFromAS.signature,
        dataSalt: dataResponseFromAS.data_salt,
        data: dataResponseFromAS.data,
      });
    })
  );
}
