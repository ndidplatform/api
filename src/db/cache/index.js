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
import * as cacheDb from './redis';

import logger from '../../logger';

const dbName = 'cache';

export async function close() {
  await cacheDb.close();
  logger.info({
    message: 'DB connection closed',
    dbName,
  });
}

//
// Used by all roles
//

export function getAllExpectedTxs() {
  return db.getAll({ dbName, name: 'expectedTx' });
}

export function getExpectedTxMetadata(txHash) {
  return db.get({
    dbName,
    name: 'expectedTx',
    keyName: 'tx',
    key: txHash,
    valueName: 'metadata',
  });
}

export function setExpectedTxMetadata(txHash, metadata) {
  return db.set({
    dbName,
    name: 'expectedTx',
    keyName: 'tx',
    key: txHash,
    valueName: 'metadata',
    value: metadata,
  });
}

export function removeExpectedTxMetadata(txHash) {
  return db.remove({
    dbName,
    name: 'expectedTx',
    keyName: 'tx',
    key: txHash,
  });
}

export function getCallbackUrlByReferenceId(referenceId) {
  return db.get({
    dbName,
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'url',
  });
}

export function setCallbackUrlByReferenceId(referenceId, callbackUrl) {
  return db.set({
    dbName,
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'url',
    value: callbackUrl,
  });
}

export function removeCallbackUrlByReferenceId(referenceId) {
  return db.remove({
    dbName,
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function addCallbackWithRetryData(cbId, data) {
  return db.pushToList({
    dbName,
    name: 'callbackWithRetry',
    keyName: 'cbId',
    key: cbId,
    valueName: 'data',
    value: data,
  });
}

export function removeCallbackWithRetryData(cbId) {
  return db.remove({
    dbName,
    name: 'callbackWithRetry',
    keyName: 'cbId',
    key: cbId,
  });
}

export function getAllCallbackWithRetryData() {
  return db.getAll({
    dbName,
    name: 'callbackWithRetry',
  });
}

//
// Used by RP, IdP, and AS
//

export function setRawMessageFromMQ(messageId, messageBuffer) {
  return db.set({
    dbName,
    name: 'rawReceivedMessageFromMQ',
    keyName: 'messageId',
    key: messageId,
    valueName: 'messageBuffer',
    value: messageBuffer,
  });
}

export function getRawMessageFromMQ(messageId) {
  return db.get({
    dbName,
    name: 'rawReceivedMessageFromMQ',
    keyName: 'messageId',
    key: messageId,
  });
}

export function removeRawMessageFromMQ(messageId) {
  return db.remove({
    dbName,
    name: 'rawReceivedMessageFromMQ',
    keyName: 'messageId',
    key: messageId,
  });
}

export function getAllRawMessageFromMQ() {
  return db.getAll({
    dbName,
    name: 'rawReceivedMessageFromMQ',
  });
}

export function getAllDuplicateMessageTimeout() {
  return db.getAll({ dbName, name: 'duplicateMessageTimeout' });
}

export function getDuplicateMessageTimeout(id) {
  return db.get({
    dbName,
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
    valueName: 'unixTimeout',
  });
}

export function setDuplicateMessageTimeout(id, unixTimeout) {
  return db.set({
    dbName,
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
    valueName: 'unixTimeout',
    value: unixTimeout,
  });
}

export function removeDuplicateMessageTimeout(id) {
  return db.remove({
    dbName,
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
  });
}

//
// Used by IdP and AS
//

export function getRequestIdsExpectedInBlock(fromHeight, toHeight) {
  return db.getListRange({
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

export function getRequestIdExpectedInBlock(height) {
  return db.getListWithRangeSupport({
    dbName,
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'requestId',
  });
}

export function addRequestIdExpectedInBlock(height, requestId) {
  return db.pushToListWithRangeSupport({
    dbName,
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'requestId',
    value: requestId,
  });
}

export function removeRequestIdsExpectedInBlock(fromHeight, toHeight) {
  return db.removeListRange({
    dbName,
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
  });
}

export function getRequestReceivedFromMQ(requestId) {
  return db.get({
    dbName,
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestReceivedFromMQ(requestId, request) {
  return db.set({
    dbName,
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestReceivedFromMQ(requestId) {
  return db.remove({
    dbName,
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
  });
}

//
// Used by RP and IdP
//

export function getRequestIdByReferenceId(referenceId) {
  return db.get({
    dbName,
    name: 'requestIdReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'requestId',
  });
}

export function setRequestIdByReferenceId(referenceId, requestId) {
  return db.set({
    dbName,
    name: 'requestIdReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'requestId',
    value: requestId,
  });
}

export function removeRequestIdByReferenceId(referenceId) {
  return db.remove({
    dbName,
    name: 'requestIdReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function removeRequestIdReferenceIdMappingByRequestId(requestId) {
  return db.remove({
    dbName,
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getReferenceIdByRequestId(requestId) {
  return db.get({
    dbName,
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'referenceId',
  });
}

export function setReferenceIdByRequestId(requestId, referenceId) {
  return db.set({
    dbName,
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'referenceId',
    value: referenceId,
  });
}

export function removeReferenceIdByRequestId(requestId) {
  return db.remove({
    dbName,
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRequestCallbackUrl(requestId) {
  return db.get({
    dbName,
    name: 'requestCallbackUrl',
    keyName: 'requestId',
    key: requestId,
    valueName: 'url',
  });
}

export function setRequestCallbackUrl(requestId, callbackUrl) {
  return db.set({
    dbName,
    name: 'requestCallbackUrl',
    keyName: 'requestId',
    key: requestId,
    valueName: 'url',
    value: callbackUrl,
  });
}

export function removeRequestCallbackUrl(requestId) {
  return db.remove({
    dbName,
    name: 'requestCallbackUrl',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRequestData(requestId) {
  return db.get({
    dbName,
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestData(requestId, request) {
  return db.set({
    dbName,
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestData(requestId) {
  return db.remove({
    dbName,
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getAllTimeoutScheduler() {
  return db.getAll({ dbName, name: 'timeoutScheduler' });
}

export function setTimeoutScheduler(requestId, unixTimeout) {
  return db.set({
    dbName,
    name: 'timeoutScheduler',
    keyName: 'requestId',
    key: requestId,
    valueName: 'unixTimeout',
    value: unixTimeout,
  });
}

export function removeTimeoutScheduler(requestId) {
  return db.remove({
    dbName,
    name: 'timeoutScheduler',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getIdpResponseValidList(requestId) {
  return db.getList({
    dbName,
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
    valueName: 'validInfo',
  });
}

export function addIdpResponseValidList(requestId, validInfo) {
  return db.pushToList({
    dbName,
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
    valueName: 'validInfo',
    value: validInfo,
  });
}

export function removeIdpResponseValidList(requestId) {
  return db.removeList({
    dbName,
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getPublicProofReceivedFromMQ(responseId) {
  return db.get({
    dbName,
    name: 'publicProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'publicProofArray',
  });
}

export function setPublicProofReceivedFromMQ(responseId, publicProofArray) {
  return db.set({
    dbName,
    name: 'publicProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'publicProofArray',
    value: publicProofArray,
  });
}

export function removePublicProofReceivedFromMQ(responseId) {
  return db.remove({
    dbName,
    name: 'publicProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
  });
}

export function getPrivateProofReceivedFromMQ(responseId) {
  return db.get({
    dbName,
    name: 'privateProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'privateProofObject',
  });
}

export function setPrivateProofReceivedFromMQ(responseId, privateProofObject) {
  return db.set({
    dbName,
    name: 'privateProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'privateProofObject',
    value: privateProofObject,
  });
}

export function removePrivateProofReceivedFromMQ(responseId) {
  return db.remove({
    dbName,
    name: 'privateProofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
  });
}

export function getChallengeFromRequestId(requestId) {
  return db.get({
    dbName,
    name: 'challengeFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'challenge',
  });
}

export function setChallengeFromRequestId(requestId, challenge) {
  return db.set({
    dbName,
    name: 'challengeFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'challenge',
    value: challenge,
  });
}

export function removeChallengeFromRequestId(requestId) {
  return db.remove({
    dbName,
    name: 'challengeFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

//
// Used by RP
//

export function getExpectedIdpResponseNodeIdInBlockList(height) {
  return db.getList({
    dbName,
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseMetadata',
  });
}

export function addExpectedIdpResponseNodeIdInBlock(height, responseMetadata) {
  return db.pushToList({
    dbName,
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseMetadata',
    value: responseMetadata,
  });
}

export function removeExpectedIdpResponseNodeIdInBlockList(height) {
  return db.removeList({
    dbName,
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
  });
}

export function getExpectedIdpPublicProofInBlockList(fromHeight, toHeight) {
  return db.getListRange({
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

export function addExpectedIdpPublicProofInBlock(height, responseMetadata) {
  return db.pushToListWithRangeSupport({
    dbName,
    name: 'expectedIdpPublicProofInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseMetadata',
    value: responseMetadata,
  });
}

export function removeExpectedIdpPublicProofInBlockList(fromHeight, toHeight) {
  return db.removeListRange({
    dbName,
    name: 'expectedIdpPublicProofInBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
  });
}

export function getDataResponsefromAS(asResponseId) {
  return db.get({
    dbName,
    name: 'dataResponseFromAS',
    keyName: 'asResponseId',
    key: asResponseId,
    valueName: 'dataResponse',
  });
}
export function setDataResponseFromAS(asResponseId, data) {
  return db.set({
    dbName,
    name: 'dataResponseFromAS',
    keyName: 'asResponseId',
    key: asResponseId,
    valueName: 'dataResponse',
    value: data,
  });
}

export function removeDataResponseFromAS(asResponseId) {
  return db.remove({
    dbName,
    name: 'dataResponseFromAS',
    keyName: 'asResponseId',
    key: asResponseId,
  });
}

export function getDatafromAS(requestId) {
  return db.getList({
    dbName,
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
    valueName: 'data',
  });
}

export function countDataFromAS(requestId) {
  return db.count({
    dbName,
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
  });
}

export function addDataFromAS(requestId, data) {
  return db.pushToList({
    dbName,
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
    valueName: 'data',
    value: data,
  });
}

export function removeDataFromAS(requestId) {
  return db.removeList({
    dbName,
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
  });
}

export function removeAllDataFromAS() {
  return db.removeAllLists({
    dbName,
    name: 'dataFromAS',
  });
}

export function getExpectedDataSignInBlockList(height) {
  return db.getList({
    dbName,
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'metadata',
  });
}

export function addExpectedDataSignInBlock(height, metadata) {
  return db.pushToList({
    dbName,
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'metadata',
    value: metadata,
  });
}

export function removeExpectedDataSignInBlockList(height) {
  return db.removeList({
    dbName,
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
  });
}

//
// Used by IdP
//

export function getRequestToProcessReceivedFromMQ(requestId) {
  return db.get({
    dbName,
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestToProcessReceivedFromMQ(requestId, request) {
  return db.set({
    dbName,
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestToProcessReceivedFromMQ(requestId) {
  return db.remove({
    dbName,
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getResponseFromRequestId(requestId) {
  return db.get({
    dbName,
    name: 'responseDataFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'response',
  });
}

export function setResponseFromRequestId(requestId, response) {
  return db.set({
    dbName,
    name: 'responseDataFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'response',
    value: response,
  });
}

export function removeResponseFromRequestId(requestId) {
  return db.remove({
    dbName,
    name: 'responseDataFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRPIdFromRequestId(requestId) {
  return db.get({
    dbName,
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'rp_id',
  });
}

export function setRPIdFromRequestId(requestId, rp_id) {
  return db.set({
    dbName,
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'rp_id',
    value: rp_id,
  });
}

export function removeRPIdFromRequestId(requestId) {
  return db.remove({
    dbName,
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getIdentityFromRequestId(requestId) {
  return db.get({
    dbName,
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'identity',
  });
}

export function setIdentityFromRequestId(requestId, identity) {
  return db.set({
    dbName,
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'identity',
    value: identity,
  });
}

export function removeIdentityFromRequestId(requestId) {
  return db.remove({
    dbName,
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getCreateIdentityDataByReferenceId(referenceId) {
  return db.get({
    dbName,
    name: 'createIdentityDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'createIdentityData',
  });
}

export function setCreateIdentityDataByReferenceId(
  referenceId,
  createIdentityData
) {
  return db.set({
    dbName,
    name: 'createIdentityDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'createIdentityData',
    value: createIdentityData,
  });
}

export function removeCreateIdentityDataByReferenceId(referenceId) {
  return db.remove({
    dbName,
    name: 'createIdentityDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function getRequestMessage(requestId) {
  return db.get({
    dbName,
    name: 'requestMessage',
    keyName: 'requestId',
    key: requestId,
    valueName: 'requestMessageAndSalt',
  });
}

export function setRequestMessage(requestId, requestMessageAndSalt) {
  return db.set({
    dbName,
    name: 'requestMessage',
    keyName: 'requestId',
    key: requestId,
    valueName: 'requestMessageAndSalt',
    value: requestMessageAndSalt,
  });
}

export function removeRequestMessage(requestId) {
  return db.remove({
    dbName,
    name: 'requestMessage',
    keyName: 'requestId',
    key: requestId,
  });
}

//
// Used by AS
//

export function getInitialSalt(requestId) {
  return db.get({
    dbName,
    name: 'initialSalt',
    keyName: 'requestId',
    key: requestId,
    valueName: 'initialSalt',
  });
}

export function setInitialSalt(requestId, initialSalt) {
  return db.set({
    dbName,
    name: 'initialSalt',
    keyName: 'requestId',
    key: requestId,
    valueName: 'initialSalt',
    value: initialSalt,
  });
}

export function removeInitialSalt(requestId) {
  return db.remove({
    dbName,
    name: 'initialSalt',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRpIdFromDataRequestId(dataRequestId) {
  return db.get({
    dbName,
    name: 'rpIdFromDataRequestId',
    keyName: 'dataRequestId',
    key: dataRequestId,
    valueName: 'rpId',
  });
}

export function setRpIdFromDataRequestId(dataRequestId, rpId) {
  return db.set({
    dbName,
    name: 'rpIdFromDataRequestId',
    keyName: 'dataRequestId',
    key: dataRequestId,
    valueName: 'rpId',
    value: rpId,
  });
}

export function removeRpIdFromDataRequestId(dataRequestId) {
  return db.remove({
    dbName,
    name: 'rpIdFromDataRequestId',
    keyName: 'dataRequestId',
    key: dataRequestId,
  });
}
