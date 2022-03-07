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

import EventEmitter from 'events';

import { getFunction } from '../functions';

import * as tendermint from '../tendermint';
import * as cacheDb from '../db/cache';
import * as utils from '../utils';

import { delegateToWorker } from '../master-worker-interface/server';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../logger';

import MODE from '../mode';
import * as config from '../config';

const messageProcessLock = {};
const requestQueue = {};
const requestQueueRunning = {};

let stopping = false;

const eventEmitter = new EventEmitter();

let pendingTasksInQueueCount = 0;
let processingTasksCount = 0;
let requestsInQueueCount = 0;
export const metricsEventEmitter = new EventEmitter();

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
  // TODO: Remove after cause for error (process before expecting block height) is found
  logger.debug({
    message: 'Determine wait for block',
    latestBlockHeightType: typeof latestBlockHeight,
    tendermintLatestBlockHeight: latestBlockHeight,
    messageBlockHeightType: typeof message.height,
    messageBlockHeight: message.height,
    waitForBlock: latestBlockHeight <= message.height,
  });
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

export async function processMessageInBlocks({
  fromHeight,
  toHeight,
  nodeId,
  processMessageFnName,
}) {
  const messageIds = await cacheDb.getMessageIdsToProcessAtBlock(
    nodeId,
    fromHeight,
    toHeight
  );
  await Promise.all(
    messageIds.map(async (messageId) => {
      if (messageProcessLock[messageId]) return;
      const message = await cacheDb.getMessageFromMQ(nodeId, messageId);
      if (message == null) return;
      const requestId = message.request_id;
      await addTaskToQueue({
        nodeId,
        requestId,
        callbackFnName: processMessageFnName,
        callbackArgs: [nodeId, messageId, message],
        onCallbackFinished: releaseLockAndCleanUp,
        onCallbackFinishedArgs: [nodeId, messageId],
      });
    })
  );
}

function releaseLock(messageId) {
  delete messageProcessLock[messageId];
}

function releaseLockAndCleanUp(nodeId, messageId) {
  releaseLock(messageId);
  cleanUpMessage(nodeId, messageId);
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
    logger.error({ err });
  }
}

export async function addMqMessageTaskToQueue({
  nodeId,
  messageId,
  message,
  processMessageFnName,
}) {
  const requestId = message.request_id;
  await addTaskToQueue({
    nodeId,
    requestId,
    callbackFnName: processMessageFnName,
    callbackArgs: [nodeId, messageId, message],
    onCallbackFinished: releaseLock,
    onCallbackFinishedArgs: [messageId],
  });
}

export async function restoreTaskFromPersistentQueue() {
  const tasksInRequestProcessQueue = await cacheDb.getAllTasksInRequestProcessQueue(
    config.nodeId
  );
  tasksInRequestProcessQueue.forEach((requestId, tasks) => {
    requestQueue[requestId] = tasks;
    //TODO: batch incremental?
    tasks.forEach(() => {
      incrementPendingTasksInQueueCount();
    });
    setImmediate(executeTaskInQueue, requestId);
  });
}

export async function addTaskToQueue({
  nodeId,
  requestId,
  callbackFnName,
  callbackArgs,
  onCallbackFinished,
  onCallbackFinishedArgs,
}) {
  logger.debug({
    message: 'Adding task to queue',
    nodeId,
    requestId,
  });

  const taskData = {
    nodeId,
    callbackFnName,
    callbackArgs,
    onCallbackFinished,
    onCallbackFinishedArgs,
    startTime: Date.now(),
  };
  await cacheDb.addTaskToRequestProcessQueue(
    config.nodeId,
    requestId,
    taskData
  );

  if (stopping) return;

  let startQueue = false;
  if (requestQueue[requestId] == null) {
    requestQueue[requestId] = [];
    startQueue = true;
    incrementRequestsInQueueCount();
  }
  requestQueue[requestId].push(taskData);
  incrementPendingTasksInQueueCount();

  if (startQueue) {
    setImmediate(executeTaskInQueue, requestId);
  }
}

function executeTaskInQueue(requestId) {
  if (requestQueueRunning[requestId]) return;
  const task = requestQueue[requestId].shift();
  if (task) {
    requestQueueRunning[requestId] = true;
    const {
      nodeId,
      callbackFnName,
      callbackArgs,
      onCallbackFinished,
      onCallbackFinishedArgs,
      startTime: pendingStartTime,
    } = task;
    logger.debug({
      message: 'Executing task in queue',
      nodeId,
      requestId,
    });
    decrementPendingTasksInQueueCount();
    notifyTaskPendingTime(pendingStartTime);
    incrementProcessingTasksCount();
    const startTime = Date.now();

    if (config.mode === MODE.STANDALONE) {
      getFunction(callbackFnName)(...callbackArgs)
        .then(() => onTaskExecutionSuccess(startTime))
        .catch(onTaskExecutionFail)
        .then(() =>
          onTaskExecutionFinished({
            requestId,
            onCallbackFinished,
            onCallbackFinishedArgs,
          })
        );
    } else if (config.mode === MODE.MASTER) {
      delegateToWorker({
        fnName: callbackFnName,
        args: callbackArgs,
        callback: onTaskExecutionCallback,
        additionalCallbackArgs: {
          requestId,
          startTime,
          onCallbackFinished,
          onCallbackFinishedArgs,
        },
      });
    } else {
      throw new Error('Unsupported mode');
    }
  } else {
    cleanUpQueue(requestId);
  }
}

function onTaskExecutionSuccess(startTime) {
  notifyTaskProcessTime(startTime);
}

function onTaskExecutionFail(error, requestId) {
  const err = new CustomError({
    message: 'Error executing task in queue',
    cause: error,
    details: {
      requestId,
    },
  });
  logger.error({ err });
  notifyTaskProcessFail();
}

function onTaskExecutionFinished({
  requestId,
  onCallbackFinished,
  onCallbackFinishedArgs,
}) {
  decrementProcessingTasksCount();
  if (onCallbackFinished) {
    onCallbackFinished(...onCallbackFinishedArgs);
  }
  delete requestQueueRunning[requestId];
  if (requestQueue[requestId].length === 0) {
    cleanUpQueue(requestId);
  } else {
    setImmediate(executeTaskInQueue, requestId);
  }
  cacheDb
    .removeFirstTaskFromRequestProcessQueue(config.nodeId, requestId)
    .catch((error) => {
      logger.error({
        message: 'Cannot remove task from request task queue',
        cause: error,
        details: {
          requestId,
        },
      });
    });
}

function onTaskExecutionCallback(
  error,
  result,
  { requestId, startTime, onCallbackFinished, onCallbackFinishedArgs }
) {
  if (!error) {
    onTaskExecutionSuccess(startTime);
  } else {
    onTaskExecutionFail(error);
  }

  onTaskExecutionFinished({
    requestId,
    onCallbackFinished,
    onCallbackFinishedArgs,
  });
}

function cleanUpQueue(requestId) {
  logger.debug({
    message: 'Queue is empty, cleaning up',
    requestId,
  });
  delete requestQueue[requestId];
  cacheDb
    .removeAllTasksFromRequestProcessQueue(config.nodeId, requestId)
    .catch((error) => {
      logger.error({
        message: 'Cannot remove request task queue',
        cause: error,
        details: {
          requestId,
        },
      });
    });
  decrementRequestsInQueueCount();
}

function waitForAllRequestProcessToFinish() {
  if (requestsInQueueCount > 0) {
    logger.info({
      message: 'Waiting for request processes to finish',
      requestsInQueueCount,
    });
    return new Promise((resolve) =>
      eventEmitter.once('request_process_queue_empty', () => resolve())
    );
  }
}

export async function stop() {
  stopping = true;
  await waitForAllRequestProcessToFinish();
}

function incrementPendingTasksInQueueCount() {
  pendingTasksInQueueCount++;
  metricsEventEmitter.emit(
    'pendingTasksInQueueCount',
    pendingTasksInQueueCount
  );
}

function decrementPendingTasksInQueueCount() {
  pendingTasksInQueueCount--;
  metricsEventEmitter.emit(
    'pendingTasksInQueueCount',
    pendingTasksInQueueCount
  );
}

function notifyTaskPendingTime(startTime) {
  metricsEventEmitter.emit(
    'taskPendingTime',
    // type,
    Date.now() - startTime
  );
}

function incrementProcessingTasksCount() {
  processingTasksCount++;
  metricsEventEmitter.emit('processingTasksCount', processingTasksCount);
}

function decrementProcessingTasksCount() {
  processingTasksCount--;
  metricsEventEmitter.emit('processingTasksCount', processingTasksCount);
}

function notifyTaskProcessTime(startTime) {
  metricsEventEmitter.emit(
    'taskProcessTime',
    // type,
    Date.now() - startTime
  );
}

function notifyTaskProcessFail() {
  metricsEventEmitter.emit('taskProcessFail');
}

function incrementRequestsInQueueCount() {
  requestsInQueueCount++;
  metricsEventEmitter.emit('requestsInQueueCount', requestsInQueueCount);
}

function decrementRequestsInQueueCount() {
  requestsInQueueCount--;
  metricsEventEmitter.emit('requestsInQueueCount', requestsInQueueCount);
  if (requestsInQueueCount === 0) {
    eventEmitter.emit('request_process_queue_empty');
  }
}
