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

export function removePendingOutboundMessage(nodeId, msgId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'pendingOutboundMessages',
    keyName: 'msgId',
    key: msgId,
  });
}

//
// Used by IdP and AS
//

export function getRequestIdsExpectedInBlock(nodeId, fromHeight, toHeight) {
  return db.getListRange({
    nodeId,
    dbName,
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
    valueName: 'requestId',
  });
}

export function getRequestIdExpectedInBlock(nodeId, height) {
  return db.getListWithRangeSupport({
    nodeId,
    dbName,
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'requestId',
  });
}

export function addRequestIdExpectedInBlock(nodeId, height, requestId) {
  return db.pushToListWithRangeSupport({
    nodeId,
    dbName,
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'requestId',
    value: requestId,
  });
}

export function removeRequestIdsExpectedInBlock(nodeId, fromHeight, toHeight) {
  return db.removeListRange({
    nodeId,
    dbName,
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
  });
}

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

export function getPublicProofReceivedFromMQ(nodeId, responseId) {
  return db.get({
    nodeId,
    dbName,
    name: 'publicProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'publicProofArray',
  });
}

export function setPublicProofReceivedFromMQ(
  nodeId,
  responseId,
  publicProofArray
) {
  return db.set({
    nodeId,
    dbName,
    name: 'publicProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'publicProofArray',
    value: publicProofArray,
  });
}

export function removePublicProofReceivedFromMQ(nodeId, responseId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'publicProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
  });
}

export function getPrivateProofReceivedFromMQ(nodeId, responseId) {
  return db.get({
    nodeId,
    dbName,
    name: 'privateProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'privateProofObject',
  });
}

export function setPrivateProofReceivedFromMQ(
  nodeId,
  responseId,
  privateProofObject
) {
  return db.set({
    nodeId,
    dbName,
    name: 'privateProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'privateProofObject',
    value: privateProofObject,
  });
}

export function removePrivateProofReceivedFromMQ(nodeId, responseId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'privateProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
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

export function getPrivateProofObjectListInRequest(nodeId, requestId) {
  return db.getList({
    nodeId,
    dbName,
    name: 'privateProofObjectListInRequest',
    keyName: 'requestId',
    key: requestId,
    valueName: 'privateProofObjectList',
  });
}

export function addPrivateProofObjectInRequest(
  nodeId,
  requestId,
  privateProofObject
) {
  return db.pushToList({
    nodeId,
    dbName,
    name: 'privateProofObjectListInRequest',
    keyName: 'requestId',
    key: requestId,
    valueName: 'privateProofObjectList',
    value: privateProofObject,
  });
}

export function removePrivateProofObjectListInRequest(nodeId, requestId) {
  return db.removeList({
    nodeId,
    dbName,
    name: 'privateProofObjectListInRequest',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getExpectedIdpResponseNodeIdInBlockList(nodeId, height) {
  return db.getList({
    nodeId,
    dbName,
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseMetadata',
  });
}

export function addExpectedIdpResponseNodeIdInBlock(
  nodeId,
  height,
  responseMetadata
) {
  return db.pushToList({
    nodeId,
    dbName,
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseMetadata',
    value: responseMetadata,
  });
}

export function removeExpectedIdpResponseNodeIdInBlockList(nodeId, height) {
  return db.removeList({
    nodeId,
    dbName,
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
  });
}

export function getExpectedIdpPublicProofInBlockList(
  nodeId,
  fromHeight,
  toHeight
) {
  return db.getListRange({
    nodeId,
    dbName,
    name: 'expectedIdpPublicProofInBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
    valueName: 'responseMetadata',
  });
}

export function addExpectedIdpPublicProofInBlock(
  nodeId,
  height,
  responseMetadata
) {
  return db.pushToListWithRangeSupport({
    nodeId,
    dbName,
    name: 'expectedIdpPublicProofInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseMetadata',
    value: responseMetadata,
  });
}

export function removeExpectedIdpPublicProofInBlockList(
  nodeId,
  fromHeight,
  toHeight
) {
  return db.removeListRange({
    nodeId,
    dbName,
    name: 'expectedIdpPublicProofInBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
  });
}

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

export function getExpectedDataSignInBlockList(nodeId, height) {
  return db.getList({
    nodeId,
    dbName,
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'metadata',
  });
}

export function addExpectedDataSignInBlock(nodeId, height, metadata) {
  return db.pushToList({
    nodeId,
    dbName,
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'metadata',
    value: metadata,
  });
}

export function removeExpectedDataSignInBlockList(nodeId, height) {
  return db.removeList({
    nodeId,
    dbName,
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
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

export function getAccessorIdToRevokeFromRequestId(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'accessorIdToRevokeFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'accessorId',
  });
}

export function setAccessorIdToRevokeFromRequestId(nodeId, requestId, accessorId) {
  return db.set({
    nodeId,
    dbName,
    name: 'accessorIdToRevokeFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'accessorId',
    value: accessorId,
  });
}

export function removeAccessorIdToRevokeFromRequestId(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'accessorIdToRevokeFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getResponseFromRequestId(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'responseDataFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'response',
  });
}

export function setResponseFromRequestId(nodeId, requestId, response) {
  return db.set({
    nodeId,
    dbName,
    name: 'responseDataFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'response',
    value: response,
  });
}

export function removeResponseFromRequestId(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'responseDataFromRequestId',
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

export function getCreateIdentityDataByReferenceId(nodeId, referenceId) {
  return db.get({
    nodeId,
    dbName,
    name: 'createIdentityDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'createIdentityData',
  });
}

export function setCreateIdentityDataByReferenceId(
  nodeId,
  referenceId,
  createIdentityData
) {
  return db.set({
    nodeId,
    dbName,
    name: 'createIdentityDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'createIdentityData',
    value: createIdentityData,
  });
}

export function removeCreateIdentityDataByReferenceId(nodeId, referenceId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'createIdentityDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function getRevokeAccessorDataByReferenceId(nodeId, referenceId) {
  return db.get({
    nodeId,
    dbName,
    name: 'revokeAccessorDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'revokeAccessorData',
  });
}

export function setRevokeAccessorDataByReferenceId(
  nodeId,
  referenceId,
  revokeAccessorData
) {
  return db.set({
    nodeId,
    dbName,
    name: 'revokeAccessorDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'revokeAccessorData',
    value: revokeAccessorData,
  });
}

export function removeRevokeAccessorDataByReferenceId(nodeId, referenceId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'revokeAccessorDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function getRequestMessage(nodeId, requestId) {
  return db.get({
    nodeId,
    dbName,
    name: 'requestMessage',
    keyName: 'requestId',
    key: requestId,
    valueName: 'requestMessageAndSalt',
  });
}

export function setRequestMessage(nodeId, requestId, requestMessageAndSalt) {
  return db.set({
    nodeId,
    dbName,
    name: 'requestMessage',
    keyName: 'requestId',
    key: requestId,
    valueName: 'requestMessageAndSalt',
    value: requestMessageAndSalt,
  });
}

export function removeRequestMessage(nodeId, requestId) {
  return db.remove({
    nodeId,
    dbName,
    name: 'requestMessage',
    keyName: 'requestId',
    key: requestId,
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
