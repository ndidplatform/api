import * as db from './sequelize';

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

export function getCallbackUrl(requestId) {
  return db.get({
    name: 'callbackUrl',
    keyName: 'requestId',
    key: requestId,
    valueName: 'url',
  });
}

export function setCallbackUrl(requestId, callbackUrl) {
  return db.set({
    name: 'callbackUrl',
    keyName: 'requestId',
    key: requestId,
    valueName: 'url',
    value: callbackUrl,
  });
}

export function removeCallbackUrl(requestId) {
  return db.remove({
    name: 'callbackUrl',
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
