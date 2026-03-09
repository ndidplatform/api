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

import { timeoutRequest } from '.';
import * as yourDataRequestQueueManager from '../yourdata/request_queue_manager';
import { timeoutRequest as timeoutYourDataRequest } from '../yourdata/rp/timeout_request';
import { timeoutDataDecryptionKeyRetryRequest } from '../yourdata/rp/data_decryption_key_retry_request';

import * as lt from '../../utils/long_timeout';
import * as config from '../../config';
import * as cacheDb from '../../db/cache';

import { delegateToWorker } from '../../master-worker-interface/server';
import { broadcastRemoveRequestTimeoutScheduler } from '../../master-worker-interface/client';

import logger from '../../logger';

import MODE from '../../mode';

let pendingRequestTimeout = {};

export const metricsEventEmitter = new EventEmitter();

export let timeoutScheduler = {};

export async function resumeTimeoutScheduler(nodeIds) {
  if (nodeIds == null) return;
  nodeIds.forEach(async (nodeId) => {
    const schedulers = await cacheDb.getAllTimeoutScheduler(nodeId);
    schedulers.forEach(({ requestId, timeoutMetadata }) => {
      const { type, unixTimeout } = timeoutMetadata;
      const timeoutInSeconds = (unixTimeout - Date.now()) / 1000;
      logger.info({
        message: 'Resuming timeout schedulers',
        nodeId,
        requestId,
        unixTimeout,
        timeoutInSeconds,
      });
      if (config.mode === MODE.STANDALONE) {
        runTimeoutScheduler(nodeId, requestId, type, unixTimeout);
      } else if (config.mode === MODE.MASTER) {
        delegateToWorker({
          fnName: 'common.runTimeoutScheduler',
          args: [nodeId, requestId, type, unixTimeout],
        });
      }
    });
  });
}

export function stopAllTimeoutScheduler() {
  for (let nodeIdAndrequestId in timeoutScheduler) {
    lt.clearTimeout(timeoutScheduler[nodeIdAndrequestId]);
  }
}

export function runTimeoutScheduler(nodeId, requestId, type, unixTimeout) {
  const now = Date.now();
  if (now >= unixTimeout) {
    if (type === 'yourdata') {
      yourDataRequestQueueManager.enqueue(
        nodeId,
        requestId,
        timeoutYourDataRequest,
        nodeId,
        requestId
      );
    } else if (type === 'yourdata.data_decryption_key_retry_request') {
      yourDataRequestQueueManager.enqueue(
        nodeId,
        requestId,
        timeoutDataDecryptionKeyRetryRequest,
        nodeId,
        requestId
      );
    } else {
      timeoutRequest(nodeId, requestId);
    }
  } else {
    if (config.mode === MODE.WORKER) {
      pendingRequestTimeout[requestId] = { type, deadline: unixTimeout };
    }
    const timeout = unixTimeout - now;
    timeoutScheduler[`${nodeId}:${requestId}`] = lt.setTimeout(() => {
      if (type === 'yourdata') {
        yourDataRequestQueueManager.enqueue(
          nodeId,
          requestId,
          timeoutYourDataRequest,
          nodeId,
          requestId
        );
      } else if (type === 'yourdata.data_decryption_key_retry_request') {
        yourDataRequestQueueManager.enqueue(
          nodeId,
          requestId,
          timeoutDataDecryptionKeyRetryRequest,
          nodeId,
          requestId
        );
      } else {
        timeoutRequest(nodeId, requestId);
      }
    }, timeout);
  }
}

export async function setTimeoutScheduler({
  nodeId,
  requestId,
  type,
  secondsToTimeout,
}) {
  const unixTimeout = Date.now() + secondsToTimeout * 1000;
  const timeoutMetadata = { type, unixTimeout };
  await cacheDb.setTimeoutScheduler(nodeId, requestId, timeoutMetadata);
  runTimeoutScheduler(nodeId, requestId, type, unixTimeout);
  return { timeoutAtMsec: unixTimeout };
}

export function removeTimeoutScheduler(nodeId, requestId) {
  if (
    config.mode === MODE.WORKER &&
    timeoutScheduler[`${nodeId}:${requestId}`] == null
  ) {
    // Scheduler may be on another worker
    return broadcastRemoveRequestTimeoutScheduler({ nodeId, requestId });
  } else {
    return removeTimeoutSchedulerInternal(nodeId, requestId);
  }
}

export async function removeTimeoutSchedulerInternal(nodeId, requestId) {
  lt.clearTimeout(timeoutScheduler[`${nodeId}:${requestId}`]);
  await cacheDb.removeTimeoutScheduler(nodeId, requestId);
  if (config.mode === MODE.WORKER) {
    delete pendingRequestTimeout[requestId];
  }
  delete timeoutScheduler[`${nodeId}:${requestId}`];
}

export function getPendingRequestTimeout() {
  return pendingRequestTimeout;
}
