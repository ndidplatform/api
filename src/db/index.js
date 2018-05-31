import * as db from './sequelize';

import logger from '../logger';

export async function close() {
  await db.close();
  logger.info({
    message: 'DB connection closed',
  });
}

//
// Used by IDP and AS
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

export function getResponseIdsExpectedInBlock(height) {
  return db.getList({
    name: 'responseIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseId',
  });
}

export function addResponseIdsExpectedInBlock(height, responseId) {
  return db.pushToList({
    name: 'responseIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    key: height,
    valueName: 'responseId',
    value: responseId,
  });
}

export function removeResponseIdsExpectedInBlock(fromHeight, toHeight) {
  return db.removeListRange({
    name: 'responseIdExpectedInBlock',
    keyName: 'expectedBlockHeight',
    keyRange: {
      gte: fromHeight, // greaterThanOrEqual
      lte: toHeight, // lessThanOrEqual
    },
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

export function getProofReceivedFromMQ(responseId) {
  return db.get({
    name: 'proofReceivedFromMQ',
    keyName: 'responseId',
    key: responseId,
    valueName: 'privateProofObject',
  });
}

export function setProofReceivedFromMQ(responseId, privateProofObject) {
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

export function removeRequestIdReferenceIdMappingByRequestId(requestId) {
  return db.remove({
    name: 'requestIdReferenceIdMapping',
    keyName: 'requestId',
    key: requestId,
  });
}

export function getRequestToSendToAS(requestId) {
  return db.get({
    name: 'requestToSendToAS',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
  });
}

export function setRequestToSendToAS(requestId, request) {
  return db.set({
    name: 'requestToSendToAS',
    keyName: 'requestId',
    key: requestId,
    valueName: 'request',
    value: request,
  });
}

export function removeRequestToSendToAS(requestId) {
  return db.remove({
    name: 'requestToSendToAS',
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

export function addDataFromAS(requestId, data) {
  return db.pushToList({
    name: 'dataFromAS',
    keyName: 'requestId',
    key: requestId,
    valueKey: 'data',
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
