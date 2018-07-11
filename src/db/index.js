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

import * as db from './sequelize';

import logger from '../logger';

export async function close() {
  await db.close();
  logger.info({
    message: 'DB connection closed',
  });
}

//
// Used by RP, IdP, and AS
//

export function getCallbackUrlByReferenceId(referenceId) {
  return db.get({
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'url',
  });
}

export function setCallbackUrlByReferenceId(referenceId, callbackUrl) {
  return db.set({
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'url',
    value: callbackUrl,
  });
}

export function removeCallbackUrlByReferenceId(referenceId) {
  return db.remove({
    name: 'callbackUrl',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function getRequestData(requestId) {
  return db.get({
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestData(requestId, request) {
  return db.set({
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestData(requestId) {
  return db.remove({
    name: 'requestData',
    keyName: 'requestId',
    key: requestId,
  });
}

export function addCallbackWithRetryData(cbId, data) {
  return db.pushToList({
    name: 'callbackWithRetry',
    keyName: 'cbId',
    key: cbId,
    valueName: 'data',
    value: data,
  });
}

export function removeCallbackWithRetryData(cbId) {
  return db.remove({
    name: 'callbackWithRetry',
    keyName: 'cbId',
    key: cbId,
  });
}

export function getAllCallbackWithRetryData() {
  return db.getAll({
    name: 'callbackWithRetry',
  });
}

//
// Used by IdP and AS
//

export function getRequestIdsExpectedInBlock(fromHeight, toHeight) {
  return db.getListRange({
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
  return db.getList({
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'requestId',
  });
}

export function addRequestIdExpectedInBlock(height, requestId) {
  return db.pushToList({
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'requestId',
    value: requestId,
  });
}

export function removeRequestIdsExpectedInBlock(fromHeight, toHeight) {
  return db.removeListRange({
    name: 'requestIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
  });
}

export function getExpectedIdpResponseNodeIdInBlockList(height) {
  return db.getList({
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseMetadata',
  });
}

export function addExpectedIdpResponseNodeIdInBlock(height, responseMetadata) {
  return db.pushToList({
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseMetadata',
    value: responseMetadata,
  });
}

export function removeExpectedIdpResponseNodeIdInBlockList(height) {
  return db.removeList({
    name: 'expectedIdpResponseNodeIdInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
  });
}

export function getRequestReceivedFromMQ(requestId) {
  return db.get({
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestReceivedFromMQ(requestId, request) {
  return db.set({
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestReceivedFromMQ(requestId) {
  return db.remove({
    name: 'requestReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRequestToProcessReceivedFromMQ(requestId) {
  return db.get({
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestToProcessReceivedFromMQ(requestId, request) {
  return db.set({
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestToProcessReceivedFromMQ(requestId) {
  return db.remove({
    name: 'requestToProcessReceivedFromMQ',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getResponseFromRequestId(requestId) {
  return db.get({
    name: 'responseDataFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'response',
  });
}

export function setResponseFromRequestId(requestId, response) {
  return db.set({
    name: 'responseDataFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'response',
    value: response,
  });
}

export function removeResponseFromRequestId(requestId) {
  return db.remove({
    name: 'responseDataFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRPIdFromRequestId(requestId) {
  return db.get({
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'rp_id',
  });
}

export function setRPIdFromRequestId(requestId, rp_id) {
  return db.set({
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'rp_id',
    value: rp_id,
  });
}

export function removeRPIdFromRequestId(requestId) {
  return db.remove({
    name: 'rpIdFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getIdentityFromRequestId(requestId) {
  return db.get({
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'identity',
  });
}

export function setIdentityFromRequestId(requestId, identity) {
  return db.set({
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'identity',
    value: identity,
  });
}

export function removeIdentityFromRequestId(requestId) {
  return db.remove({
    name: 'identityRequestIdMapping',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getChallengeFromRequestId(requestId) {
  return db.get({
    name: 'challengeFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'challenge',
  });
}

export function setChallengeFromRequestId(requestId, challenge) {
  return db.set({
    name: 'challengeFromRequestId',
    keyName: 'requestId',
    key: requestId,
    valueName: 'challenge',
    value: challenge,
  });
}

export function removeChallengeFromRequestId(requestId) {
  return db.remove({
    name: 'challengeFromRequestId',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getPrivateProofReceivedFromMQ(responseId) {
  return db.get({
    name: 'proofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'privateProofObject',
  });
}

export function setPrivateProofReceivedFromMQ(responseId, privateProofObject) {
  return db.set({
    name: 'proofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'privateProofObject',
    value: privateProofObject,
  });
}

export function removeProofReceivedFromMQ(responseId) {
  return db.remove({
    name: 'proofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
  });
}

export function getPublicProofReceivedFromMQ(responseId) {
  return db.get({
    name: 'proofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'publicProofArray',
  });
}

export function setPublicProofReceivedFromMQ(responseId, publicProofArray) {
  return db.set({
    name: 'proofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'publicProofArray',
    value: publicProofArray,
  });
}

//
// Used by RP
//

export function getRequestIdByReferenceId(referenceId) {
  return db.get({
    name: 'requestIdReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'requestId',
  });
}

export function setRequestIdByReferenceId(referenceId, requestId) {
  return db.set({
    name: 'requestIdReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'requestId',
    value: requestId,
  });
}

export function removeRequestIdByReferenceId(referenceId) {
  return db.remove({
    name: 'requestIdReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function getOnboardDataByReferenceId(referenceId) {
  return db.get({
    name: 'onboardDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'onboardData',
  });
}

export function setOnboardDataByReferenceId(referenceId, onboardData) {
  return db.set({
    name: 'requestIdReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
    valueName: 'onboardData',
    value: onboardData,
  });
}

export function removeOnboardDataByReferenceId(referenceId) {
  return db.remove({
    name: 'onboardDataReferenceIdMapping',
    keyName: 'referenceId',
    key: referenceId,
  });
}

export function removeRequestIdReferenceIdMappingByRequestId(requestId) {
  return db.remove({
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getServiceCallbackUrl(serviceId) {
  return db.get({
    name: 'serviceCallbackUrl',
    keyName: 'serviceId',
    key: serviceId,
    valueName: 'url',
  });
}

export function setServiceCallbackUrl(serviceId, callbackUrl) {
  return db.set({
    name: 'serviceCallbackUrl',
    keyName: 'serviceId',
    key: serviceId,
    valueName: 'url',
    value: callbackUrl,
  });
}

export function getRequestCallbackUrl(requestId) {
  return db.get({
    name: 'requestCallbackUrl',
    keyName: 'requestId',
    key: requestId,
    valueName: 'url',
  });
}

export function setRequestCallbackUrl(requestId, callbackUrl) {
  return db.set({
    name: 'requestCallbackUrl',
    keyName: 'requestId',
    key: requestId,
    valueName: 'url',
    value: callbackUrl,
  });
}

export function removeRequestCallbackUrl(requestId) {
  return db.remove({
    name: 'requestCallbackUrl',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getDatafromAS(requestId) {
  return db.getList({
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
    valueName: 'data',
  });
}

export function countDataFromAS(requestId) {
  return db.count({
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
  });
}

export function addDataFromAS(requestId, data) {
  return db.pushToList({
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
    valueName: 'data',
    value: data,
  });
}

export function removeDataFromAS(requestId) {
  return db.removeList({
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
  });
}

export function removeAllDataFromAS() {
  return db.removeAllLists({
    name: 'dataFromAS',
  });
}

export function getAllTimeoutScheduler() {
  return db.getAll({ name: 'timeoutScheduler' });
}

export function addTimeoutScheduler(requestId, unixTimeout) {
  return db.set({
    name: 'timeoutScheduler',
    keyName: 'requestId',
    key: requestId,
    valueName: 'unixTimeout',
    value: unixTimeout,
  });
}

export function removeTimeoutScheduler(requestId) {
  return db.remove({
    name: 'timeoutScheduler',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getAllDuplicateMessageTimeout() {
  return db.getAll({ name: 'duplicateMessageTimeout' });
}

export function getDuplicateMessageTimeout(id) {
  return db.get({ 
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
    valueName: 'unixTimeout',
  });
}

export function addDuplicateMessageTimeout(id, unixTimeout) {
  return db.set({
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
    valueName: 'unixTimeout',
    value: unixTimeout,
  });
}

export function removeDuplicateMessageTimeout(id) {
  return db.remove({
    name: 'duplicateMessageTimeout',
    keyName: 'id',
    key: id,
  });
}

export function getIdpResponseValidList(requestId) {
  return db.getList({
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
    valueName: 'validInfo',
  });
}

export function addIdpResponseValidList(requestId, validInfo) {
  return db.pushToList({
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
    valueName: 'validInfo',
    value: validInfo,
  });
}

export function removeIdpResponseValidList(requestId) {
  return db.removeList({
    name: 'idpResponseValid',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getExpectedDataSignInBlockList(height) {
  return db.getList({
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'metadata',
  });
}

export function addExpectedDataSignInBlock(height, metadata) {
  return db.pushToList({
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'metadata',
    value: metadata,
  });
}

export function removeExpectedDataSignInBlockList(height) {
  return db.removeList({
    name: 'expectedDataSignInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
  });
}

//
// Used by IdP
//

export function getReferenceIdByRequestId(requestId) {
  return db.get({
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'referenceId',
  });
}

export function setReferenceIdByRequestId(requestId, referenceId) {
  return db.set({
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
    valueName: 'referenceId',
    value: referenceId,
  });
}

export function removeReferenceIdByRequestId(requestId) {
  return db.remove({
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
  });
}
