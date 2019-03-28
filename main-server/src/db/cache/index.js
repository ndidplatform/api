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

import * as db from '../redis_common';
import redisInstance from './redis';

import logger from '../../logger';

const dbName = 'cache';

export function getRedisInstance() {
  return redisInstance;
}

export function initialize() {
  return redisInstance.connect();
}

export async function close() {
  await redisInstance.close();
  logger.info({
    message: 'DB connection closed',
    dbName,
  });
}

export async function changeAllDataKeysWithExpectedBlockHeight(
  nodeId,
  newHeight
) {
  if (!Number.isInteger(newHeight)) {
    throw new Error('Invalid new height. Must be an integer.');
  }

  const flattenList = await db.getFlattenListWithRangeSupport({
    nodeId,
    dbName,
    name: 'messageIdToProcessAtBlock',
    keyName: 'expectedBlockHeight',
    valueName: 'messageId',
  });
  await db.removeListWithRangeSupport({
    nodeId,
    dbName,
    name: 'requestIdExpectedInBlock',
  });
  await Promise.all(
    flattenList.map((messageId) =>
      addMessageIdToProcessAtBlock(nodeId, newHeight, messageId)
    )
  );
}

//
// Used by all roles
//

export function getAllExpectedTxs(nodeId) {
  return db.getAll({
    nodeId,
    dbName,
    name: 'expectedTx',
    keyName: 'tx',
    valueName: 'metadata',
  });
}

export function getExpectedTxMetadata(nodeId, txHash) {
  return db.get({
    nodeId,
    dbName,
    name: 'expectedTx',
    keyName: 'tx',
    key: txHash,
    valueName: 'metadata',
  });
}

export function setExpectedTxMetadata(nodeId, txHash, metadata) {
  return db.set({
    nodeId,
    dbName,
    name: 'expectedTx',
    keyName: 'tx',
    key: txHash,
    valueName: 'metadata',
    value: metadata,
  });
}

export function removeExpectedTxMetadata(nodeId, txHash) {
  return db.remove({
    nodeId,
    dbName,
    name: 'expectedTx',
    keyName: 'tx',
    key: txHash,
  });
}

export function getCallbackUrlByReferenceId(nodeId, referenceId) {
  return db.get({
    nodeId,
    dbName,
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'url',
  });
}

export function setCallbackUrlByReferenceId(nodeId, referenceId, callbackUrl) {
  return db.set({
    nodeId,
    dbName,
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'url',
    value: callbackUrl,
  });
}

export function removeCallbackUrlByReferenceId(nodeId, referenceId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function setCallbackWithRetryData(nodeId, cbId, data) {
  return db.set({
    nodeId,
    dbName,
    name: 'callbackWithRetry',
    keyName: 'cbId',
    key: cbId,
    valueName: 'data',
    value: data,
  });
}

export function getCallbackWithRetryData(nodeId, cbId) {
  return db.get({
    nodeId,
    dbName,
    name: 'callbackWithRetry',
    keyName: 'cbId',
    key: cbId,
    valueName: 'data',
  });
}

export function removeCallbackWithRetryData(nodeId, cbId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'callbackWithRetry',
    keyName: 'cbId',
    key: cbId,
  });
}

export function getAllCallbackWithRetryData(nodeId) {
  return db.getAll({
    nodeId,
    dbName,
    name: 'callbackWithRetry',
    keyName: 'cbId',
    valueName: 'data',
  });
}

export function getAllTransactRequestForRetry(nodeId) {
  return db.getAll({
    nodeId,
    dbName,
    name: 'transactRequestForRetry',
    keyName: 'id',
    valueName: 'transactParams',
  });
}

export function addTransactRequestForRetry(nodeId, id, transactParams) {
  return db.set({
    nodeId,
    dbName,
    name: 'transactRequestForRetry',
    keyName: 'id',
    key: id,
    valueName: 'transactParams',
    value: transactParams,
  });
}

export function removeTransactRequestForRetry(nodeId, id) {
  return db.remove({
    nodeId,
    dbName,
    name: 'transactRequestForRetry',
    keyName: 'id',
    key: id,
  });
}

//
// Used by RP, IdP, and AS
//

export function setRawMessageFromMQ(nodeId, messageId, messageBuffer) {
  return db.set({
    nodeId,
    dbName,
    name: 'rawReceivedMessageFromMQ',
    keyName: 'messageId',
    key: messageId,
    valueName: 'messageBuffer',
    value: messageBuffer,
  });
}

export function getRawMessageFromMQ(nodeId, messageId) {
  return db.get({
    nodeId,
    dbName,
    name: 'rawReceivedMessageFromMQ',
    keyName: 'messageId',
    key: messageId,
  });
}

export function removeRawMessageFromMQ(nodeId, messageId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'rawReceivedMessageFromMQ',
    keyName: 'messageId',
    key: messageId,
  });
}

export function getAllRawMessageFromMQ(nodeId) {
  return db.getAll({
    nodeId,
    dbName,
    name: 'rawReceivedMessageFromMQ',
    keyName: 'messageId',
    valueName: 'messageBuffer',
  });
}

export function getAllDuplicateMessageTimeout(nodeId) {
  return db.getAll({
    nodeId,
    dbName,
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    valueName: 'unixTimeout',
  });
}

export function getDuplicateMessageTimeout(nodeId, id) {
  return db.get({
    nodeId,
    dbName,
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
    valueName: 'unixTimeout',
  });
}

export function setDuplicateMessageTimeout(nodeId, id, unixTimeout) {
  return db.set({
    nodeId,
    dbName,
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
    valueName: 'unixTimeout',
    value: unixTimeout,
  });
}

export function removeDuplicateMessageTimeout(nodeId, id) {
  return db.remove({
    nodeId,
    dbName,
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
  });
}

export function getAllPendingOutboundMessages(nodeId) {
  return db.getAll({
    nodeId,
    dbName,
    name: 'pendingOutboundMessages',
    keyName: 'msgId',
    valueName: 'data',
  });
}

export function setPendingOutboundMessage(nodeId, msgId, data) {
  return db.set({
    nodeId,
    dbName,
    name: 'pendingOutboundMessages',
    keyName: 'msgId',
    key: msgId,
    valueName: 'data',
    value: data,
  });
}

export function getPendingOutboundMessage(nodeId, msgId) {
  return db.get({
    nodeId,
    dbName,
    name: 'pendingOutboundMessages',
    keyName: 'msgId',
    key: msgId,
  });
}

export function removePendingOutboundMessage(nodeId, msgId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'pendingOutboundMessages',
    keyName: 'msgId',
    key: msgId,
  });
}

////

export function setMessageFromMQ(nodeId, messageId, message) {
  return db.set({
    nodeId,
    dbName,
    name: 'messageFromMQ',
    keyName: 'messageId',
    key: messageId,
    valueName: 'message',
    value: message,
  });
}

export function getMessageFromMQ(nodeId, messageId) {
  return db.get({
    nodeId,
    dbName,
    name: 'messageFromMQ',
    keyName: 'messageId',
    key: messageId,
  });
}

export function removeMessageFromMQ(nodeId, messageId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'messageFromMQ',
    keyName: 'messageId',
    key: messageId,
  });
}

export function getMessageIdsToProcessAtBlock(nodeId, fromHeight, toHeight) {
  return db.getListRange({
    nodeId,
    dbName,
    name: 'messageIdToProcessAtBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
    valueName: 'messageId',
  });
}

export function getMessageIdToProcessAtBlock(nodeId, height) {
  return db.getListWithRangeSupport({
    nodeId,
    dbName,
    name: 'messageIdToProcessAtBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'messageId',
  });
}

export function addMessageIdToProcessAtBlock(nodeId, height, messageId) {
  return db.pushToListWithRangeSupport({
    nodeId,
    dbName,
    name: 'messageIdToProcessAtBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'messageId',
    value: messageId,
  });
}

export function removeMessageIdsToProcessAtBlock(nodeId, fromHeight, toHeight) {
  return db.removeListRange({
    nodeId,
    dbName,
    name: 'messageIdToProcessAtBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
  });
}

export function removeMessageIdToProcessAtBlock(nodeId, messageId) {
  return db.removeFromListWithRangeSupport({
    nodeId,
    dbName,
    name: 'messageIdToProcessAtBlock',
    keyName: 'expectedBlockHeight',
    valueName: 'messageId',
    value: messageId,
  });
}

////

//
// Used by IdP and AS
//

export function getRequestReceivedFromMQ(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestReceivedFromMQ(nodeId, requestId, request) {
  return db.set({
    nodeId,
    dbName,
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestReceivedFromMQ(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
  });
}

//
// Used by RP and IdP
//

export function getRequestIdByReferenceId(nodeId, referenceId) {
  return db.get({
    nodeId,
    dbName,
    name: 'referenceIdRequestIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'requestId',
  });
}

export function setRequestIdByReferenceId(nodeId, referenceId, requestId) {
  return db.set({
    nodeId,
    dbName,
    name: 'referenceIdRequestIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'requestId',
    value: requestId,
  });
}

export function removeRequestIdByReferenceId(nodeId, referenceId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'referenceIdRequestIdMapping',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function getRequestData(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestData(nodeId, requestId, request) {
  return db.set({
    nodeId,
    dbName,
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestData(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getAllTimeoutScheduler(nodeId) {
  return db.getAll({
    nodeId,
    dbName,
    name: 'timeoutScheduler',
    keyName: 'requestId',
    valueName: 'unixTimeout',
  });
}

export function setTimeoutScheduler(nodeId, requestId, unixTimeout) {
  return db.set({
    nodeId,
    dbName,
    name: 'timeoutScheduler',
    keyName: 'requestId',
    key: requestId,
    valueName: 'unixTimeout',
    value: unixTimeout,
  });
}

export function removeTimeoutScheduler(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'timeoutScheduler',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getIdpResponseValidList(nodeId, requestId) {
  return db.getList({
    nodeId,
    dbName,
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
    valueName: 'validInfo',
  });
}

export function addIdpResponseValidList(nodeId, requestId, validInfo) {
  return db.pushToList({
    nodeId,
    dbName,
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
    valueName: 'validInfo',
    value: validInfo,
  });
}

export function removeIdpResponseValidList(nodeId, requestId) {
  return db.removeList({
    nodeId,
    dbName,
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRequestCreationMetadata(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'requestCreationMetadata',
    keyName: 'requestId',
    key: requestId,
    valueName: 'metadata',
  });
}

export function setRequestCreationMetadata(nodeId, requestId, metadata) {
  return db.set({
    nodeId,
    dbName,
    name: 'requestCreationMetadata',
    keyName: 'requestId',
    key: requestId,
    valueName: 'metadata',
    value: metadata,
  });
}

export function removeRequestCreationMetadata(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'requestCreationMetadata',
    keyName: 'requestId',
    key: requestId,
  });
}

//
// Used by RP
//

export function getDataResponsefromAS(nodeId, asResponseId) {
  return db.get({
    nodeId,
    dbName,
    name: 'dataResponseFromAS',
    keyName: 'asResponseId',
    key: asResponseId,
    valueName: 'dataResponse',
  });
}
export function setDataResponseFromAS(nodeId, asResponseId, data) {
  return db.set({
    nodeId,
    dbName,
    name: 'dataResponseFromAS',
    keyName: 'asResponseId',
    key: asResponseId,
    valueName: 'dataResponse',
    value: data,
  });
}

export function removeDataResponseFromAS(nodeId, asResponseId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'dataResponseFromAS',
    keyName: 'asResponseId',
    key: asResponseId,
  });
}

export function getDatafromAS(nodeId, requestId) {
  return db.getList({
    nodeId,
    dbName,
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
    valueName: 'data',
  });
}

export function countDataFromAS(nodeId, requestId) {
  return db.count({
    nodeId,
    dbName,
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
  });
}

export function addDataFromAS(nodeId, requestId, data) {
  return db.pushToList({
    nodeId,
    dbName,
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
    valueName: 'data',
    value: data,
  });
}

export function removeDataFromAS(nodeId, requestId) {
  return db.removeList({
    nodeId,
    dbName,
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
  });
}

export function removeAllDataFromAS(nodeId) {
  return db.removeAllLists({
    nodeId,
    dbName,
    name: 'dataFromAS',
  });
}

export function getResponsePrivateDataListForRequest(nodeId, requestId) {
  return db.getList({
    nodeId,
    dbName,
    name: 'responsePrivateDataForRequest',
    keyName: 'requestId',
    key: requestId,
    valueName: 'responsePrivateDataList',
  });
}

export function addResponsePrivateDataForRequest(
  nodeId,
  requestId,
  responsePrivateData
) {
  return db.pushToList({
    nodeId,
    dbName,
    name: 'responsePrivateDataForRequest',
    keyName: 'requestId',
    key: requestId,
    valueName: 'responsePrivateDataList',
    value: responsePrivateData,
  });
}

export function removeResponsePrivateDataListForRequest(nodeId, requestId) {
  return db.removeList({
    nodeId,
    dbName,
    name: 'responsePrivateDataForRequest',
    keyName: 'requestId',
    key: requestId,
  });
}

//
// Used by IdP
//

export function getRequestToProcessReceivedFromMQ(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestToProcessReceivedFromMQ(nodeId, requestId, request) {
  return db.set({
    nodeId,
    dbName,
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestToProcessReceivedFromMQ(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getReferenceGroupCodeFromRequestId(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'referenceGroupCodeFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'referenceGroupCode',
  });
}

export function setReferenceGroupCodeFromRequestId(
  nodeId,
  requestId,
  referenceGroupCode
) {
  return db.set({
    nodeId,
    dbName,
    name: 'referenceGroupCodeFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'referenceGroupCode',
    value: referenceGroupCode,
  });
}

export function removeReferenceGroupCodeFromRequestId(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'referenceGroupCodeFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRPIdFromRequestId(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'rp_id',
  });
}

export function setRPIdFromRequestId(nodeId, requestId, rp_id) {
  return db.set({
    nodeId,
    dbName,
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'rp_id',
    value: rp_id,
  });
}

export function removeRPIdFromRequestId(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getIdentityFromRequestId(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'identity',
  });
}

export function setIdentityFromRequestId(nodeId, requestId, identity) {
  return db.set({
    nodeId,
    dbName,
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'identity',
    value: identity,
  });
}

export function removeIdentityFromRequestId(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getIdentityRequestDataByReferenceId(nodeId, referenceId) {
  return db.get({
    nodeId,
    dbName,
    name: 'identityRequestDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'identityRequestData',
  });
}

export function setIdentityRequestDataByReferenceId(
  nodeId,
  referenceId,
  identityRequestData
) {
  return db.set({
    nodeId,
    dbName,
    name: 'identityRequestDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'identityRequestData',
    value: identityRequestData,
  });
}

export function removeIdentityRequestDataByReferenceId(nodeId, referenceId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'identityRequestDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
  });
}

//
// Used by AS
//

export function getInitialSalt(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'initialSalt',
    keyName: 'requestId',
    key: requestId,
    valueName: 'initialSalt',
  });
}

export function setInitialSalt(nodeId, requestId, initialSalt) {
  return db.set({
    nodeId,
    dbName,
    name: 'initialSalt',
    keyName: 'requestId',
    key: requestId,
    valueName: 'initialSalt',
    value: initialSalt,
  });
}

export function removeInitialSalt(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'initialSalt',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRpIdFromDataRequestId(nodeId, dataRequestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'rpIdFromDataRequestId',
    keyName: 'dataRequestId',
    key: dataRequestId,
    valueName: 'rpId',
  });
}

export function setRpIdFromDataRequestId(nodeId, dataRequestId, rpId) {
  return db.set({
    nodeId,
    dbName,
    name: 'rpIdFromDataRequestId',
    keyName: 'dataRequestId',
    key: dataRequestId,
    valueName: 'rpId',
    value: rpId,
  });
}

export function removeRpIdFromDataRequestId(nodeId, dataRequestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'rpIdFromDataRequestId',
    keyName: 'dataRequestId',
    key: dataRequestId,
  });
}

export function addTaskToRequestProcessQueue(nodeId, requestId, task) {
  return db.pushToList({
    nodeId,
    dbName,
    name: 'persistentRequestProcessQueue',
    keyName: 'requestId',
    key: requestId,
    valueName: 'task',
    value: task,
  });
}

export function getAllTasksInRequestProcessQueue(nodeId) {
  return db.getAll({
    nodeId,
    dbName,
    name: 'persistentRequestProcessQueue',
    keyName: 'requestId',
    valueName: 'tasks',
  });
}

export function removeFirstTaskFromRequestProcessQueue(nodeId, requestId) {
  return db.popFromList({
    nodeId,
    dbName,
    name: 'persistentRequestProcessQueue',
    keyName: 'requestId',
    key: requestId,
  });
}

export function removeAllTasksFromRequestProcessQueue(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'persistentRequestProcessQueue',
    keyName: 'requestId',
    key: requestId,
  });
}
