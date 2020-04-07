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

import { getIncomingRequestStatusUpdateCallbackUrl } from '.';

import * as utils from '../../utils';
import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import logger from '../../logger';

import * as common from '../common';
import * as identity from '../identity';
import * as requestProcessManager from '../request_process_manager';
import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';

import { delegateToWorker } from '../../master-worker-interface/server';

import * as config from '../../config';
import MODE from '../../mode';

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
  const startTime = Date.now();

  const requestId = message.request_id;

  try {
    const addToProcessQueue = await requestProcessManager.handleMessageFromMqWithBlockWait(
      messageId,
      message,
      nodeId
    );

    if (addToProcessQueue) {
      await requestProcessManager.addMqMessageTaskToQueue({
        nodeId,
        messageId,
        message,
        processMessageFnName: 'idp.processMessage',
      });
      common.notifyMetricsInboundMessageProcessTime(
        'does_not_wait_for_block',
        startTime
      );
    } else {
      // Save message to redis cache time
      common.notifyMetricsInboundMessageProcessTime(
        'wait_for_block',
        startTime
      );
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling message from message queue',
      cause: error,
    });
    logger.error({ err });
    common.notifyMetricsFailInboundMessageProcess();
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'idp.getErrorCallbackUrl',
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

  const startTime = Date.now();
  try {
    await requestProcessManager.processMessageInBlocks({
      fromHeight,
      toHeight,
      nodeId,
      processMessageFnName: 'idp.processMessage',
    });
    await processTasksInBlocks(parsedTransactionsInBlocks, nodeId);
    common.notifyMetricsBlockProcessTime(startTime);
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling Tendermint NewBlock event',
      cause: error,
    });
    logger.error({ err });
    common.notifyMetricsFailedBlockProcess();
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'idp.getErrorCallbackUrl',
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
    .map(({ valid_ial, valid_signature }) => {
      return valid_ial && valid_signature;
    })
    .reduce((accum, pilot) => {
      return accum && pilot;
    }, true);
}

function processTasksInBlocks(parsedTransactionsInBlocks, nodeId) {
  return Promise.all(
    parsedTransactionsInBlocks.map(async ({ height, transactions }) => {
      const identityRequestsToProcess = {}; // For clean up closed or timed out create identity requests
      const incomingRequestsToProcessUpdate = {};
      const identityModificationsToCheckForNotification = [];

      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        if (!transaction.success) {
          continue;
        }

        if (
          [
            'RegisterIdentity',
            'AddIdentity',
            'AddAccessor',
            'RevokeAccessor',
            'RevokeIdentityAssociation',
            'RevokeAndAddAccessor',
            'UpdateIdentityModeList',
          ].includes(transaction.fnName)
        ) {
          identityModificationsToCheckForNotification.push(transaction);
          continue;
        }

        const requestId = transaction.args.request_id;
        if (requestId == null) continue;

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

            identityRequestsToProcess[requestId] = {
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
            identityRequestsToProcess[requestId] = {
              requestId,
              action: 'timeout',
            };
            continue;
          }
        }
      }

      logger.debug({
        message: 'Create identity requests to process',
        identityRequestsToProcess,
      });

      logger.debug({
        message: "Inbound requests' update to process",
        incomingRequestsToProcessUpdate,
      });

      logger.debug({
        message: 'Identity modifications/changes to check for notification',
        identityModificationsToCheckForNotification,
      });

      if (config.mode === MODE.STANDALONE) {
        identityModificationsToCheckForNotification.forEach((transaction) => {
          identity.handleIdentityModificationTransactions({
            nodeId,
            getCallbackUrlFnName:
              'idp.getIdentityModificationNotificationCallbackUrl',
            transaction,
          });
        });
      } else if (config.mode === MODE.MASTER) {
        identityModificationsToCheckForNotification.forEach((transaction) => {
          delegateToWorker({
            fnName: 'identity.handleIdentityModificationTransactions',
            args: [
              {
                nodeId,
                getCallbackUrlFnName:
                  'idp.getIdentityModificationNotificationCallbackUrl',
                transaction,
              },
            ],
          });
        });
      }
      await Promise.all([
        ...Object.values(identityRequestsToProcess).map(
          ({ requestId, action }) =>
            requestProcessManager.addTaskToQueue({
              nodeId,
              requestId,
              callbackFnName: 'idp.processIdentityRequest',
              callbackArgs: [nodeId, requestId, action],
            })
        ),
        ...Object.values(incomingRequestsToProcessUpdate).map(
          ({ requestId, cleanUp }) =>
            requestProcessManager.addTaskToQueue({
              nodeId,
              requestId,
              callbackFnName: 'idp.processRequestUpdate',
              callbackArgs: [nodeId, requestId, height, cleanUp],
            })
        ),
      ]);
    })
  );
}

export async function processIdentityRequest(nodeId, requestId, action) {
  const requestData = await cacheDb.getRequestData(nodeId, requestId);
  const referenceId = requestData.reference_id;
  const identityCallbackUrl = await cacheDb.getCallbackUrlByReferenceId(
    nodeId,
    referenceId
  );

  logger.debug({
    message: 'Cleanup associated requestId',
    requestId,
    referenceId,
  });

  //check type
  const identityRequestData = await cacheDb.getIdentityRequestDataByReferenceId(
    nodeId,
    referenceId
  );

  let type;
  if (identityRequestData != null) {
    if (identityRequestData.type === 'RegisterIdentity') {
      type = 'create_identity_result';
    } else if (identityRequestData.type === 'AddAccessor') {
      type = 'add_accessor_result';
    } else if (identityRequestData.type === 'RevokeAccessor') {
      type = 'revoke_accessor_result';
    }
  } else {
    throw new CustomError({
      message: 'Cannot find identity request data',
      nodeId,
      referenceId,
    });
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

    await callbackToClient({
      callbackUrl: identityCallbackUrl,
      body: {
        node_id: nodeId,
        type,
        success: false,
        reference_id: referenceId,
        request_id: requestId,
        error: getErrorObjectForClient(identityError),
      },
      retry: true,
    });
  }

  await Promise.all([
    cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
    cacheDb.removeRequestData(nodeId, requestId),
    cacheDb.removeIdpResponseValidList(nodeId, requestId),
    cacheDb.removeRequestCreationMetadata(nodeId, requestId),
    cacheDb.removeIdentityRequestDataByReferenceId(nodeId, referenceId),
    cacheDb.removeIdentityFromRequestId(nodeId, requestId),
  ]);
}

export async function processRequestUpdate(nodeId, requestId, height, cleanUp) {
  const callbackUrl = await getIncomingRequestStatusUpdateCallbackUrl();
  if (callbackUrl != null) {
    const requestDetail = await tendermintNdid.getRequestDetail({
      requestId: requestId,
      height,
    });

    let requestDetailsForCallback;
    if (config.callbackApiVersion === 4) {
      const requestStatus = utils.getDetailedRequestStatusLegacy(requestDetail);

      requestDetailsForCallback = {
        ...requestStatus,
        response_valid_list: requestDetail.response_list.map(
          ({ idp_id, valid_signature, valid_ial }) => {
            return {
              idp_id,
              valid_signature,
              valid_ial,
            };
          }
        ),
      };
    } else {
      const requestStatus = utils.getRequestStatus(requestDetail);

      requestDetailsForCallback = {
        ...requestDetail,
        status: requestStatus,
      };
    }

    const eventDataForCallback = {
      node_id: nodeId,
      type: 'request_status',
      ...requestDetailsForCallback,
      block_height: `${requestDetail.creation_chain_id}:${height}`,
    };

    await callbackToClient({
      getCallbackUrlFnName: 'idp.getIncomingRequestStatusUpdateCallbackUrl',
      body: eventDataForCallback,
      retry: true,
    });
  }

  // Clean up when request is timed out or closed before IdP response
  if (cleanUp) {
    await cacheDb.removeRequestReceivedFromMQ(nodeId, requestId);
  }
}
