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

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../../logger';

import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import * as mq from '../../mq';
import { callbackToClient } from '../../callback';
import * as utils from '../../utils';
import * as lt from '../../utils/long_timeout';
import * as config from '../../config';
import { getErrorObjectForClient } from '../../utils/error';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../../mq/message/type';

import { delegateToWorker } from '../../master-worker-interface/server';
import { broadcastRemoveRequestTimeoutScheduler } from '../../master-worker-interface/client';

import MODE from '../../mode';
import ROLE from '../../role';
import { getFunction } from '../../functions';

export * from './create_request';
export * from './close_request';

let processingInboundMessagesCount = 0;

let messageQueueAddressesSet = false;

let pendingRequestTimeout = {};

export const metricsEventEmitter = new EventEmitter();

export function isMqAddressesSet() {
  return messageQueueAddressesSet;
}

export async function setMessageQueueAddress() {
  if (config.registerMqAtStartup && !messageQueueAddressesSet) {
    // FIXME: must retry on error (except some errors e.g. node disabled) or server init will fail
    // and http API will always return 503

    //query current self msq
    const selfMqAddress = await tendermintNdid.getMqAddresses(config.nodeId);
    if (selfMqAddress) {
      const { ip, port } = selfMqAddress[0];
      //if not same
      if (ip !== config.mqIp || port !== config.mqPort) {
        await tendermintNdid.setMqAddresses([
          { ip: config.mqIp, port: config.mqPort },
        ]);
        logger.info({
          message: 'Message queue addresses change registered',
        });
      } else {
        logger.info({
          message: 'Message queue addresses unchanged',
        });
      }
    } else {
      await tendermintNdid.setMqAddresses([
        { ip: config.mqIp, port: config.mqPort },
      ]);
      logger.info({
        message: 'Message queue addresses registered',
      });
    }
    messageQueueAddressesSet = true;
  }
}

export async function resumeTimeoutScheduler(nodeIds) {
  if (nodeIds == null) return;
  nodeIds.forEach(async (nodeId) => {
    const schedulers = await cacheDb.getAllTimeoutScheduler(nodeId);
    schedulers.forEach(({ requestId, unixTimeout }) => {
      const timeoutInSeconds = (unixTimeout - Date.now()) / 1000;
      logger.info({
        message: 'Resuming timeout schedulers',
        nodeId,
        requestId,
        unixTimeout,
        timeoutInSeconds,
      });
      if (config.mode === MODE.STANDALONE) {
        runTimeoutScheduler(nodeId, requestId, unixTimeout);
      } else if (config.mode === MODE.MASTER) {
        delegateToWorker({
          fnName: 'common.runTimeoutScheduler',
          args: [nodeId, requestId, unixTimeout],
        });
      }
    });
  });
}

export function checkRequestMessageIntegrity(
  requestId,
  request,
  requestDetail
) {
  const requestMessageHash = utils.hash(
    request.request_message + request.request_message_salt
  );

  const requestMessageValid =
    requestMessageHash === requestDetail.request_message_hash;
  if (!requestMessageValid) {
    logger.warn({
      message: 'Request message hash mismatched',
      requestId,
    });
    logger.debug({
      message: 'Request message hash mismatched',
      requestId,
      givenRequestMessage: request.request_message,
      givenRequestMessageHashWithSalt: requestMessageHash,
      requestMessageHashFromBlockchain: requestDetail.request_message_hash,
    });
    return false;
  }
  return true;
}

export function getHandleMessageQueueErrorFn(getErrorCallbackUrlFnName) {
  return async function handleMessageQueueError(error) {
    const err = new CustomError({
      message: 'Message queue error',
      cause: error,
    });
    logger.error({ err });
    if (getErrorCallbackUrlFnName) {
      await notifyError({
        getCallbackUrlFnName: getErrorCallbackUrlFnName(),
        action: 'onMessage',
        error: err,
      });
    }
  };
}

export async function getIdpMQDestinations({
  namespace,
  identifier,
  min_ial,
  min_aal,
  idp_id_list,
  mode,
}) {
  const idpNodes = await tendermintNdid.getIdpNodesInfo({
    namespace: mode === 2 || mode === 3 ? namespace : undefined,
    identifier: mode === 2 || mode === 3 ? identifier : undefined,
    min_ial,
    min_aal,
    node_id_list: idp_id_list, // filter to include only nodes in this list if node ID exists
  });

  const receivers = idpNodes
    .map((idpNode) => {
      if (idpNode.proxy != null) {
        if (idpNode.proxy.mq == null) {
          return null;
        }
        return {
          node_id: idpNode.node_id,
          public_key: idpNode.public_key,
          proxy: {
            node_id: idpNode.proxy.node_id,
            public_key: idpNode.proxy.public_key,
            ip: idpNode.proxy.mq[0].ip,
            port: idpNode.proxy.mq[0].port,
            config: idpNode.proxy.config,
          },
        };
      } else {
        if (idpNode.mq == null) {
          return null;
        }
        return {
          node_id: idpNode.node_id,
          public_key: idpNode.public_key,
          ip: idpNode.mq[0].ip,
          port: idpNode.mq[0].port,
        };
      }
    })
    .filter((idpNode) => idpNode != null);
  return receivers;
}

//=========================================== Request related ========================================

export let timeoutScheduler = {};

export function stopAllTimeoutScheduler() {
  for (let nodeIdAndrequestId in timeoutScheduler) {
    lt.clearTimeout(timeoutScheduler[nodeIdAndrequestId]);
  }
}

export async function timeoutRequest(nodeId, requestId) {
  try {
    if (!tendermint.blockchainInitialized) {
      await new Promise((resolve) =>
        tendermint.eventEmitter.once('ready', (status) => resolve(status))
      );
    }

    const responseValidList = await cacheDb.getIdpResponseValidList(
      nodeId,
      requestId
    );

    // FOR DEBUG
    const nodeIds = {};
    for (let i = 0; i < responseValidList.length; i++) {
      if (nodeIds[responseValidList[i].idp_id]) {
        logger.error({
          message: 'Duplicate IdP ID in response valid list',
          requestId,
          responseValidList,
          action: 'timeoutRequest',
        });
        break;
      }
      nodeIds[responseValidList[i].idp_id] = true;
    }

    await tendermintNdid.timeoutRequest(
      { requestId, responseValidList },
      nodeId,
      'common.timeoutRequestAfterBlockchain',
      [
        {
          nodeId,
          requestId,
        },
      ],
      true
    );
  } catch (error) {
    logger.error({
      message: 'Cannot set timeout request',
      requestId,
      err: error,
    });
    throw error;
  }
}

export function timeoutRequestAfterBlockchain(
  { error, chainDisabledRetryLater },
  { nodeId, requestId }
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;
    cacheDb.removeTimeoutScheduler(nodeId, requestId);
  } catch (error) {
    logger.error({
      message: 'Timeout request after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      err: error,
    });
  }
}

export function runTimeoutScheduler(nodeId, requestId, unixTimeout) {
  const now = Date.now();
  if (now >= unixTimeout) {
    timeoutRequest(nodeId, requestId);
  } else {
    if (config.mode === MODE.WORKER) {
      pendingRequestTimeout[requestId] = { deadline: unixTimeout };
    }
    const timeout = unixTimeout - now;
    timeoutScheduler[`${nodeId}:${requestId}`] = lt.setTimeout(() => {
      timeoutRequest(nodeId, requestId);
    }, timeout);
  }
}

export async function setTimeoutScheduler(nodeId, requestId, secondsToTimeout) {
  const unixTimeout = Date.now() + secondsToTimeout * 1000;
  await cacheDb.setTimeoutScheduler(nodeId, requestId, unixTimeout);
  runTimeoutScheduler(nodeId, requestId, unixTimeout);
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

export async function getAndSaveIdpResponseValid({
  nodeId,
  requestStatus,
  idpId,
  responseIal,
  responseAal,
  requestDataFromMq,
}) {
  logger.debug({
    message: 'Checking IdP response (IAL)',
    requestStatus,
    idpId,
    responseIal,
    requestDataFromMq,
  });

  let validIal, validSignature;

  const requestId = requestStatus.request_id;

  const requestData = await cacheDb.getRequestData(nodeId, requestId);
  const identityInfo = await tendermintNdid.getIdentityInfo({
    namespace: requestData.namespace,
    identifier: requestData.identifier,
    node_id: idpId,
  });
  const { max_aal } = await tendermintNdid.getNodeInfo(idpId);

  if (requestStatus.mode === 1) {
    validIal = null; // Cannot check in mode 1
    validSignature = null;
  } else if (requestStatus.mode === 2 || requestStatus.mode === 3) {
    // IAL check
    if (responseIal === identityInfo.ial && responseIal >= requestData.min_ial) {
      validIal = true;
    } else {
      validIal = false;
    }

    // Signature check
    const requestReferenceGroupCode = await tendermintNdid.getReferenceGroupCode(
      requestData.namespace,
      requestData.identifier
    );
    const responseReferenceGroupCode = await tendermintNdid.getReferenceGroupCodeByAccessorId(
      requestDataFromMq.accessor_id
    );
    if (requestReferenceGroupCode !== responseReferenceGroupCode) {
      validSignature = false;
    }

    const accessor_public_key = await tendermintNdid.getAccessorKey(
      requestDataFromMq.accessor_id
    );

    if (accessor_public_key) {
      const response_list = (await tendermintNdid.getRequestDetail({
        requestId: requestStatus.request_id,
      })).response_list;
      const response = response_list.find(
        (response) => response.idp_id === idpId
      );

      const { request_message, initial_salt, request_id } = requestData;
      const signature = response.signature;

      logger.debug({
        message: 'Verifying signature',
        request_message,
        initial_salt,
        accessor_public_key,
        signature,
      });

      validSignature = utils.verifyResponseSignature(
        signature,
        accessor_public_key,
        request_message,
        initial_salt,
        request_id
      );
    } else {
      logger.debug({
        message: 'Accessor key not found or inactive',
        accessorId: requestDataFromMq.accessor_id,
        idpId,
      });

      validSignature = false;
    }
  }

  const responseValid = {
    idp_id: idpId,
    valid_signature: validSignature,
    valid_ial: validIal,
    valid_aal: (responseAal >= requestData.min_aal
      && responseAal <= max_aal),
  };

  await cacheDb.addIdpResponseValidList(nodeId, requestId, responseValid);

  return responseValid;
}

/**
 * Returns false if request is closed or timed out
 * @param {string} requestId
 * @returns {boolean}
 */
export async function isRequestClosedOrTimedOut(requestId) {
  if (requestId) {
    const requestDetail = await tendermintNdid.getRequestDetail({ requestId });
    if (requestDetail.closed || requestDetail.timed_out) {
      return false;
    }
  }
  return true;
}

export async function notifyError({
  nodeId,
  getCallbackUrlFnName,
  action,
  error,
  requestId,
}) {
  logger.debug({
    message: 'Notifying error through callback',
  });
  const callbackUrl = await getFunction(getCallbackUrlFnName)();
  if (callbackUrl == null) {
    logger.warn({
      message: 'Error callback URL has not been set',
    });
    return;
  }
  await callbackToClient({
    getCallbackUrlFnName,
    body: {
      node_id: nodeId,
      type: 'error',
      action,
      request_id: requestId,
      error: getErrorObjectForClient(error),
    },
    retry: false,
  });
}

export function incrementProcessingInboundMessagesCount() {
  processingInboundMessagesCount++;
  metricsEventEmitter.emit(
    'processingInboundMessagesCount',
    processingInboundMessagesCount
  );
}

export function decrementProcessingInboundMessagesCount() {
  processingInboundMessagesCount--;
  metricsEventEmitter.emit(
    'processingInboundMessagesCount',
    processingInboundMessagesCount
  );
}

export function notifyMetricsFailInboundMessageProcess() {
  metricsEventEmitter.emit('inboundMessageProcessFail');
}

export function notifyMetricsInboundMessageProcessTime(type, startTime) {
  metricsEventEmitter.emit(
    'inboundMessageProcessTime',
    type,
    Date.now() - startTime
  );
}

export function notifyMetricsFailedBlockProcess(fromHeight, toHeight) {
  metricsEventEmitter.emit('blockProcessFail', fromHeight, toHeight);
}

export function notifyMetricsBlockProcessTime(startTime) {
  metricsEventEmitter.emit('blockProcessTime', Date.now() - startTime);
}

export function getProcessingInboundMessagesCount() {
  return processingInboundMessagesCount;
}

export function getPendingRequestTimeout() {
  return pendingRequestTimeout;
}
