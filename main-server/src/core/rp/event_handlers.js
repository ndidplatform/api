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

import { isAllIdpResponsesValid } from '.';

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as requestProcessManager from '../request_process_manager';
import * as cacheDb from '../../db/cache';
import * as utils from '../../utils';
import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import logger from '../../logger';

import * as config from '../../config';

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
        processMessageFnName: 'rp.processMessage',
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
      getCallbackUrlFnName: 'rp.getErrorCallbackUrl',
      action: 'rp.handleMessageFromQueue',
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
      processMessageFnName: 'rp.processMessage',
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
      getCallbackUrlFnName: 'rp.getErrorCallbackUrl',
      action: 'handleTendermintNewBlock',
      error: err,
    });
  }
}

function processTasksInBlocks(parsedTransactionsInBlocks, nodeId) {
  return Promise.all(
    parsedTransactionsInBlocks.map(async ({ height, transactions }) => {
      const requestIdsToProcessUpdate = {};
      await Promise.all(
        transactions
          .filter((transaction) => transaction.success)
          .map(async (transaction) => {
            const requestId = transaction.args.request_id;
            if (requestId == null) return;
            if (requestIdsToProcessUpdate[requestId] != null) return;
            const requestData = await cacheDb.getRequestData(nodeId, requestId);
            if (requestData == null) return; // This RP does not concern this request
            requestIdsToProcessUpdate[requestId] = {
              callbackUrl: requestData.callback_url,
              referenceId: requestData.reference_id,
            };
          })
      );

      await Promise.all(
        Object.entries(requestIdsToProcessUpdate).map(
          ([requestId, { callbackUrl, referenceId }]) =>
            requestProcessManager.addTaskToQueue({
              nodeId,
              requestId,
              callbackFnName: 'rp.processRequestUpdate',
              callbackArgs: [
                nodeId,
                requestId,
                height,
                callbackUrl,
                referenceId,
              ],
            })
        )
      );
    })
  );
}

/**
 *
 * @param {string} requestId
 * @param {integer} height
 */
export async function processRequestUpdate(
  nodeId,
  requestId,
  height,
  callbackUrl,
  referenceId
) {
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

  let idpResponse = false;
  if (
    requestStatus.status !== 'pending' &&
    !requestStatus.closed &&
    !requestStatus.timed_out
  ) {
    if (requestStatus.answered_idp_count < requestStatus.min_idp) {
      idpResponse = true;
    } else if (requestStatus.answered_idp_count === requestStatus.min_idp) {
      const asAnswerCount = requestStatus.service_list.reduce(
        (total, service) => total + service.signed_data_count,
        0
      );
      if (asAnswerCount === 0) {
        idpResponse = true;
      }
    }
  }

  // When it is not IdP response states which are processed by processMessage()
  if (!idpResponse) {
    const responseValidList = await cacheDb.getIdpResponseValidList(
      nodeId,
      requestId
    );

    const eventDataForCallback = {
      node_id: nodeId,
      type: 'request_status',
      ...requestStatus,
      response_valid_list: responseValidList,
      block_height: `${requestDetail.creation_chain_id}:${height}`,
    };

    await callbackToClient({
      callbackUrl,
      body: eventDataForCallback,
      retry: true,
    });

    if (
      requestStatus.status === 'completed' &&
      !requestStatus.closed &&
      !requestStatus.timed_out &&
      (requestStatus.mode === 1 ||
        ((requestStatus.mode === 2 || requestStatus.mode === 3) &&
          isAllIdpResponsesValid(responseValidList)))
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
  }

  if (requestStatus.closed || requestStatus.timed_out) {
    // Clean up
    // Clear callback url mapping, reference ID mapping, and request data to send to AS
    // since the request is no longer going to have further events
    // (the request has reached its end state)
    await Promise.all([
      cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
      cacheDb.removeRequestData(nodeId, requestId),
      cacheDb.removeResponsePrivateDataListForRequest(nodeId, requestId),
      cacheDb.removeIdpResponseValidList(nodeId, requestId),
      cacheDb.removeRequestCreationMetadata(nodeId, requestId),
    ]);
  }
}
