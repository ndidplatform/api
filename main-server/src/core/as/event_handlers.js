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

import CustomError from 'ndid-error/custom_error';
import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as requestProcessManager from '../request_process_manager';
import * as cacheDb from '../../db/cache';
import * as utils from '../../utils';
import { callbackToClient } from '../../callback';

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
        processMessageFnName: 'as.processMessage',
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
      getCallbackUrlFnName: 'as.getErrorCallbackUrl',
      action: 'as.handleMessageFromQueue',
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
      processMessageFnName: 'as.processMessage',
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
      getCallbackUrlFnName: 'as.getErrorCallbackUrl',
      action: 'handleTendermintNewBlock',
      error: err,
    });
  }
}

function processTasksInBlocks(parsedTransactionsInBlocks, nodeId) {
  return Promise.all(
    parsedTransactionsInBlocks.map(async ({ height, transactions }) => {
      const incomingRequestsToProcessUpdate = {};

      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        if (!transaction.success) {
          continue;
        }

        const requestId = transaction.args.request_id;
        if (requestId == null) continue;

        const initialSalt = await cacheDb.getInitialSalt(nodeId, requestId);
        if (initialSalt != null) {
          incomingRequestsToProcessUpdate[requestId] = {
            requestId,
            cleanUp:
              transaction.fnName === 'CloseRequest' ||
              transaction.fnName === 'TimeOutRequest',
          };
        }
      }

      await Promise.all(
        Object.values(incomingRequestsToProcessUpdate).map(
          ({ requestId, cleanUp }) =>
            requestProcessManager.addTaskToQueue({
              nodeId,
              requestId,
              callbackFnName: 'as.processRequestUpdate',
              callbackArgs: [nodeId, requestId, height, cleanUp],
            })
        )
      );
    })
  );
}

export async function processRequestUpdate(nodeId, requestId, height, cleanUp) {
  const requestDetail = await tendermintNdid.getRequestDetail({
    requestId: requestId,
    height,
  });

  const callbackUrl = await getIncomingRequestStatusUpdateCallbackUrl();
  if (callbackUrl != null) {
    const requestStatus = utils.getDetailedRequestStatus(requestDetail);

    const eventDataForCallback = {
      node_id: nodeId,
      type: 'request_status',
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
      block_height: `${requestDetail.creation_chain_id}:${height}`,
    };

    await callbackToClient({
      getCallbackUrlFnName: 'as.getIncomingRequestStatusUpdateCallbackUrl',
      body: eventDataForCallback,
      retry: true,
    });
  }

  // Clean up when request is timed out or closed before AS response
  if (cleanUp) {
    const serviceIds = requestDetail.data_request_list.map(
      (dataRequest) => dataRequest.service_id
    );
    await Promise.all([
      ...serviceIds.map(async (serviceId) => {
        const dataRequestId = requestId + ':' + serviceId;
        await cacheDb.removeRpIdFromDataRequestId(nodeId, dataRequestId);
      }),
      cacheDb.removeInitialSalt(nodeId, requestId),
    ]);
  }
}
