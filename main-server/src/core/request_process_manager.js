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

import * as tendermint from '../tendermint';
import * as cacheDb from '../db/cache';
import * as utils from '../utils';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../logger';

const messageProcessLock = {};
const requestQueue = {};
const requestQueueRunning = {};

export async function handleMessageFromMqWithBlockWait(
  messageId,
  message,
  nodeId
) {
  if (tendermint.chainId !== message.chain_id) {
    if (!(await utils.hasSeenChain(message.chain_id))) {
      throw new CustomError({
        errorType: errorType.UNRECOGNIZED_MESSAGE_CHAIN_ID,
      });
    }
  }

  const latestBlockHeight = tendermint.latestBlockHeight;
  if (latestBlockHeight <= message.height) {
    logger.debug({
      message: 'Saving message from MQ (wait for block)',
      tendermintLatestBlockHeight: latestBlockHeight,
      messageBlockHeight: message.height,
    });
    messageProcessLock[messageId] = true;
    await Promise.all([
      cacheDb.setMessageFromMQ(nodeId, messageId, message),
      cacheDb.addMessageIdToProcessAtBlock(nodeId, message.height, messageId),
    ]);
    if (tendermint.latestBlockHeight <= message.height) {
      delete messageProcessLock[messageId];
      return false;
    } else {
      await Promise.all([
        cacheDb.removeMessageFromMQ(nodeId, messageId),
        cacheDb.removeMessageIdToProcessAtBlock(nodeId, messageId),
      ]);
    }
  }
  return true;
}

export async function processMessageInBlocks(
  fromHeight,
  toHeight,
  nodeId,
  processMessage
) {
  const messageIds = await cacheDb.getMessageIdsToProcessAtBlock(
    nodeId,
    fromHeight,
    toHeight
  );
  await Promise.all(
    messageIds.map(async (messageId) => {
      if (messageProcessLock[messageId]) {
        cleanUpMessage(nodeId, messageId);
        return;
      }
      const message = await cacheDb.getMessageFromMQ(nodeId, messageId);
      if (message == null) return;
      addTaskToQueue({
        nodeId,
        messageId,
        message,
        processMessage,
        onMessageProcessFinished: cleanUpMessage,
      });
    })
  );
}

function releaseLock(messageId) {
  delete messageProcessLock[messageId];
}

async function cleanUpMessage(nodeId, messageId) {
  try {
    await Promise.all([
      cacheDb.removeMessageFromMQ(nodeId, messageId),
      cacheDb.removeMessageIdToProcessAtBlock(nodeId, messageId),
    ]);
  } catch (error) {
    const err = new CustomError({
      message: 'Error cleaning up message from cache DB',
      cause: error,
    });
    logger.error(err.getInfoForLog());
  }
}

export async function addTaskToQueue({
  nodeId,
  messageId,
  message,
  processMessage,
  onMessageProcessFinished,
}) {
  const requestId = message.request_id;

  logger.debug({
    message: 'Adding task to queue',
    nodeId,
    messageId,
    requestId,
  });

  if (requestQueue[requestId] == null) {
    requestQueue[requestId] = [];
  }
  requestQueue[requestId].push({
    nodeId,
    messageId,
    message,
    requestId,
    processMessage,
    onMessageProcessFinished,
  });

  if (!requestQueueRunning[requestId]) {
    executeTaskInQueue(requestId);
  }
}

async function executeTaskInQueue(requestId) {
  requestQueueRunning[requestId] = true;
  if (requestQueue[requestId].length === 0) {
    logger.debug({
      message: 'Queue is empty, cleaning up',
    });
    delete requestQueueRunning[requestId];
    delete requestQueue[requestId];
    return;
  }
  const {
    nodeId,
    messageId,
    message,
    processMessage,
    onMessageProcessFinished,
  } = requestQueue[requestId].shift();
  logger.debug({
    message: 'Executing task in queue',
    nodeId,
    messageId,
    requestId,
  });
  try {
    await processMessage(nodeId, messageId, message);
  } catch (error) {
    logger.error({ message: 'Error executing task in queue', requestId });
  }
  releaseLock(messageId);
  if (onMessageProcessFinished) {
    onMessageProcessFinished(nodeId, messageId);
  }
  executeTaskInQueue(requestId);
}
