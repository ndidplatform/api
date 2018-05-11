import db from './sequelize';

//
// Used by IDP and AS
//

export function getRequestIdsExpectedInBlock(fromHeight, toHeight) {
  return db.getListRange('requestIdsExpectedInBlock', {
    greaterThanOrEqual: fromHeight,
    lessThanOrEqual: toHeight,
  });
}

export function addRequestIdExpectedInBlock(height, requestId) {
  return db.pushToList('requestIdsExpectedInBlock', height, requestId);
}

export function removeRequestIdsExpectedInBlock(height, requestIds) {
  return db.removeFromList('requestIdsExpectedInBlock', height, requestIds);
}

export function getRequestReceivedFromMQ(requestId) {
  return db.get('requestReceivedFromMQ', requestId);
}

export function setRequestReceivedFromMQ(requestId, request) {
  return db.set('requestReceivedFromMQ', requestId, request);
}

export function removeRequestReceivedFromMQ(requestId) {
  return db.remove('requestReceivedFromMQ', requestId);
}

//
// Used by RP
//

export function getRequestIdByReferenceId(referenceId) {
  return db.get('requestIdReferenceIdMapping', referenceId);
}

export function setRequestIdByReferenceId(referenceId, requestId) {
  return db.set('requestIdReferenceIdMapping', referenceId, requestId);
}

export function removeRequestIdByReferenceId(referenceId) {
  return db.remove('requestIdReferenceIdMapping', referenceId);
}

export function getRequestToSendToAS(requestId) {
  return db.get('requestToSendToAS', requestId);
}

export function setRequestToSendToAS(requestId, request) {
  return db.set('requestToSendToAS', requestId, request);
}

export function removeRequestToSendToAS(requestId) {
  return db.remove('requestToSendToAS', requestId);
}

export function getCallbackUrls(requestId) {
  return db.get('callbackUrls', requestId);
}

export function setCallbackUrl(requestId, callbackUrl) {
  return db.set('callbackUrls', requestId, callbackUrl);
}

export function removeCallbackUrl(requestId) {
  return db.remove('callbackUrls', requestId);
}

export function getDatafromAS(requestId) {
  return db.getList('dataFromAS', requestId);
}

export function addDataFromAS(requestId, data) {
  return db.pushToList('dataFromAS', requestId, data);
}

export function removeDataFromAS(requestId) {
  return db.removeFromList('dataFromAS', requestId);
}

export function removeAllDataFromAS() {
  return db.removeList('dataFromAS');
}
