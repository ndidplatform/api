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

import { callbackUrls, processMessage } from '.';

import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import logger from '../../logger';

import * as common from '../common';
import * as requestProcessManager from '../request_process_manager';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../../mq/message/type';

import * as config from '../../config';
import * as tendermintNdid from '../../tendermint/ndid';

export async function handleMessageFromQueue(
  messageId,
  message,
  nodeId = config.nodeId
) {
  logger.info({
    message: 'Received message from MQ',
    messageId,
    nodeId,
  });
  logger.debug({
    message: 'Message from MQ',
    messageJSON: message,
  });

  common.incrementProcessingInboundMessagesCount();

  const requestId = message.request_id;

  try {
    //if message is challenge for response, no need to wait for blockchain
    if (message.type === privateMessageType.CHALLENGE_RESPONSE) {
      requestProcessManager.addTaskToQueue({
        nodeId,
        messageId,
        message,
        processMessage,
      });
    } else {
      const addToProcessQueue = await requestProcessManager.handleMessageFromMqWithBlockWait(
        messageId,
        message,
        nodeId
      );

      if (addToProcessQueue) {
        requestProcessManager.addTaskToQueue({
          nodeId,
          messageId,
          message,
          processMessage,
        });
      }
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
      action: 'idp.handleMessageFromQueue',
      error: err,
      requestId,
    });
  } finally {
    common.decrementProcessingInboundMessagesCount();
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
      requestProcessManager.processMessageInBlocks(
        fromHeight,
        toHeight,
        nodeId,
        processMessage
      ),
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

async function isCreateIdentityRequestValid(requestId) {
  const requestDetail = await tendermintNdid.getRequestDetail({ requestId });

  if (requestDetail.response_list.length !== requestDetail.min_idp) {
    return false;
  }

  return requestDetail.response_list
    .map(({ valid_proof, valid_ial, valid_signature }) => {
      return valid_proof && valid_ial && valid_signature;
    })
    .reduce((accum, pilot) => {
      return accum && pilot;
    }, true);
}

async function processTasksInBlocks(parsedTransactionsInBlocks, nodeId) {
  await Promise.all(
    parsedTransactionsInBlocks.map(async ({ height, transactions }) => {
      const createIdentityRequestsToProcess = {}; // For clean up closed or timed out create identity requests
      const incomingRequestsToProcessUpdate = {};

      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        const requestId = transaction.args.request_id;
        if (requestId == null) continue;
        if (transaction.fnName === 'CloseRequest') {
          // When IdP act as an RP (create identity)
          const requestData = await cacheDb.getRequestData(nodeId, requestId);
          if (requestData != null) {
            //check validResponse
            if (await isCreateIdentityRequestValid(requestId)) {
              // Exclude completed and valid request since it should have been closed
              // by the platform and a new accessor is about to be created
              continue;
            }

            createIdentityRequestsToProcess[requestId] = {
              requestId,
              action: 'close',
            };
            continue;
          }
        }
        if (transaction.fnName === 'TimeOutRequest') {
          // When IdP act as an RP (create identity)
          const requestData = await cacheDb.getRequestData(nodeId, requestId);

          if (requestData != null) {
            createIdentityRequestsToProcess[requestId] = {
              requestId,
              action: 'timeout',
            };
            continue;
          }
        }

        if (transaction.fnName === 'DeclareIdentityProof') continue;

        const requestReceivedFromMQ = await cacheDb.getRequestReceivedFromMQ(
          nodeId,
          requestId
        );

        if (requestReceivedFromMQ != null) {
          incomingRequestsToProcessUpdate[requestId] = {
            requestId,
            cleanUp:
              transaction.fnName === 'CloseRequest' ||
              transaction.fnName === 'TimeOutRequest',
          };
        }
      }

      logger.debug({
        message: 'Create identity requests to process',
        createIdentityRequestsToProcess,
      });

      logger.debug({
        message: "Inbound requests' update to process",
        incomingRequestsToProcessUpdate,
      });

      await Promise.all([
        ...Object.values(createIdentityRequestsToProcess).map(
          ({ requestId, action }) =>
            processCreateIdentityRequest(nodeId, requestId, action)
        ),
        ...Object.values(incomingRequestsToProcessUpdate).map(
          ({ requestId, cleanUp }) =>
            processRequestUpdate(nodeId, requestId, height, cleanUp)
        ),
      ]);
    })
  );
}

async function processCreateIdentityRequest(nodeId, requestId, action) {
  const requestData = await cacheDb.getRequestData(nodeId, requestId);
  const referenceId = requestData.reference_id;
  const identityCallbackUrl = await cacheDb.getCallbackUrlByReferenceId(
    nodeId,
    referenceId
  );

  let identityPromise, type;

  logger.debug({
    message: 'Cleanup associated requestId',
    requestId,
    referenceId,
  });

  //check type
  const [createIdentityData, revokeAccessorData] = await Promise.all([
    cacheDb.getCreateIdentityDataByReferenceId(nodeId, referenceId),
    cacheDb.getRevokeAccessorDataByReferenceId(nodeId, referenceId),
  ]);

  if (createIdentityData) {
    type = createIdentityData.associated
      ? 'add_accessor_result'
      : 'create_identity_result';

    identityPromise = cacheDb.removeCreateIdentityDataByReferenceId(
      nodeId,
      referenceId
    );
  } else if (revokeAccessorData) {
    type = 'revoke_accessor_result';
    identityPromise = cacheDb.removeRevokeAccessorDataByReferenceId(
      nodeId,
      referenceId
    );
  }

  if (identityCallbackUrl != null) {
    let identityError;
    if (action === 'close') {
      identityError = new CustomError({
        errorType: errorType.REQUEST_IS_CLOSED,
      });
    } else if (action === 'timeout') {
      identityError = new CustomError({
        errorType: errorType.REQUEST_IS_TIMED_OUT,
      });
    }

    await callbackToClient(
      identityCallbackUrl,
      {
        node_id: nodeId,
        type,
        success: false,
        reference_id: referenceId,
        request_id: requestId,
        error: getErrorObjectForClient(identityError),
      },
      true
    );
  }

  await Promise.all([
    cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
    cacheDb.removeRequestData(nodeId, requestId),
    cacheDb.removePrivateProofObjectListInRequest(nodeId, requestId),
    cacheDb.removeIdpResponseValidList(nodeId, requestId),
    cacheDb.removeRequestCreationMetadata(nodeId, requestId),
    identityPromise,
    cacheDb.removeIdentityFromRequestId(nodeId, requestId),
  ]);
}

async function processRequestUpdate(nodeId, requestId, height, cleanUp) {
  const callbackUrl = callbackUrls.incoming_request_status_update_url;
  if (callbackUrl != null) {
    const requestDetail = await tendermintNdid.getRequestDetail({
      requestId: requestId,
      height,
    });

    const requestStatus = utils.getDetailedRequestStatus(requestDetail);

    const eventDataForCallback = {
      node_id: nodeId,
      type: 'request_status',
      ...requestStatus,
      response_valid_list: requestDetail.response_list.map(
        ({ idp_id, valid_signature, valid_proof, valid_ial }) => {
          return {
            idp_id,
            valid_signature,
            valid_proof,
            valid_ial,
          };
        }
      ),
      block_height: `${requestDetail.creation_chain_id}:${height}`,
    };

    await callbackToClient(callbackUrl, eventDataForCallback, true);
  }

  // Clean up when request is timed out or closed before IdP response
  if (cleanUp) {
    await Promise.all([
      cacheDb.removeRequestReceivedFromMQ(nodeId, requestId),
      cacheDb.removeRPIdFromRequestId(nodeId, requestId),
      cacheDb.removeRequestMessage(nodeId, requestId),
    ]);
  }
}
