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
import { invalidateDataSchemaCache } from './data_validator';

import CustomError from 'ndid-error/custom_error';
import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as requestProcessManager from '../request_process_manager';
import * as cacheDb from '../../db/cache';
import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';

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

  const requestId = message.request_id;
  try {
    const addToProcessQueue = await requestProcessManager.handleMessageFromMqWithBlockWait(
      messageId,
      message,
      nodeId
    );

    if (addToProcessQueue) {
      requestProcessManager.addMqMessageTaskToQueue({
        nodeId,
        messageId,
        message,
        processMessage,
      });
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
  try {
    await requestProcessManager.processMessageInBlocks(
      fromHeight,
      toHeight,
      nodeId,
      processMessage
    );
    await processTasksInBlocks(parsedTransactionsInBlocks, nodeId);
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

async function processTasksInBlocks(parsedTransactionsInBlocks, nodeId) {
  await Promise.all(
    parsedTransactionsInBlocks.map(async ({ height, transactions }) => {
      const incomingRequestsToProcessUpdate = {};

      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        if (transaction.fnName === 'UpdateService') {
          invalidateDataSchemaCache(transaction.args.service_id);
          continue;
        }

        const requestId = transaction.args.request_id;
        if (requestId == null) continue;
        if (transaction.fnName === 'DeclareIdentityProof') continue;

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

      Object.values(incomingRequestsToProcessUpdate).map(
        ({ requestId, cleanUp }) =>
          requestProcessManager.addTaskToQueue({
            nodeId,
            requestId,
            callback: processRequestUpdate,
            callbackArgs: [nodeId, requestId, height, cleanUp],
          })
      );
    })
  );
}

async function processRequestUpdate(nodeId, requestId, height, cleanUp) {
  const requestDetail = await tendermintNdid.getRequestDetail({
    requestId: requestId,
    height,
  });

  const callbackUrl = callbackUrls.incoming_request_status_update_url;
  if (callbackUrl != null) {
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
