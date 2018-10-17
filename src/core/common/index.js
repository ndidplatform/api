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

import { createRequestInternalAsyncAfterBlockchain } from './create_request';
import { closeRequestInternalAsyncAfterBlockchain } from './close_request';

import CustomError from '../../error/custom_error';
import logger from '../../logger';

import { role } from '../../node';
import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import * as rp from '../rp';
import * as idp from '../idp';
import * as as from '../as';
import * as proxy from '../proxy';
import * as identity from '../identity';
import * as mq from '../../mq';
import {
  setShouldRetryFnGetter,
  setResponseCallbackFnGetter,
  resumeCallbackToClient,
  callbackToClient,
} from '../../utils/callback';
import * as utils from '../../utils';
import * as lt from '../../utils/long_timeout';
import * as config from '../../config';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../private_message_type';

export * from './create_request';
export * from './close_request';

let messageQueueAddressesSet = !config.registerMqAtStartup;

tendermint.setTxResultCallbackFnGetter(getFunction);

export function isMqAddressesSet() {
  return messageQueueAddressesSet;
}

export async function setMessageQueueAddress() {
  if (!messageQueueAddressesSet) {
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

export function readCallbackUrlsFromFiles() {
  if (role === 'rp') {
    rp.readCallbackUrlsFromFiles();
  } else if (role === 'idp') {
    idp.readCallbackUrlsFromFiles();
  } else if (role === 'as') {
    as.readCallbackUrlsFromFiles();
  } else if (role === 'proxy') {
    rp.readCallbackUrlsFromFiles();
    idp.readCallbackUrlsFromFiles();
    as.readCallbackUrlsFromFiles();
  }
}

export async function initialize() {
  let handleMessageFromQueue;
  if (role === 'rp') {
    handleMessageFromQueue = rp.handleMessageFromQueue;
    tendermint.setTendermintNewBlockEventHandler(rp.handleTendermintNewBlock);
    setShouldRetryFnGetter(getFunction);
    setResponseCallbackFnGetter(getFunction);
    resumeTimeoutScheduler();
    resumeCallbackToClient();
  } else if (role === 'idp') {
    handleMessageFromQueue = idp.handleMessageFromQueue;
    tendermint.setTendermintNewBlockEventHandler(idp.handleTendermintNewBlock);
    setShouldRetryFnGetter(getFunction);
    setResponseCallbackFnGetter(getFunction);
    resumeTimeoutScheduler();
    resumeCallbackToClient();
  } else if (role === 'as') {
    handleMessageFromQueue = as.handleMessageFromQueue;
    tendermint.setTendermintNewBlockEventHandler(as.handleTendermintNewBlock);
    setShouldRetryFnGetter(getFunction);
    setResponseCallbackFnGetter(getFunction);
    resumeCallbackToClient();
  } else if (role === 'proxy') {
    handleMessageFromQueue = proxy.handleMessageFromQueue;
    tendermint.setTendermintNewBlockEventHandler(
      proxy.handleTendermintNewBlock
    );
    setShouldRetryFnGetter(getFunction);
    setResponseCallbackFnGetter(getFunction);
    resumeTimeoutScheduler();
    resumeCallbackToClient();
  }

  if (handleMessageFromQueue) {
    mq.eventEmitter.on('message', handleMessageFromQueue);
  }
  mq.eventEmitter.on('error', handleMessageQueueError);
}

export function getFunction(fnName) {
  switch (fnName) {
    case 'common.createRequestInternalAsyncAfterBlockchain':
      return createRequestInternalAsyncAfterBlockchain;
    case 'common.closeRequestInternalAsyncAfterBlockchain':
      return closeRequestInternalAsyncAfterBlockchain;
    case 'common.isRequestClosedOrTimedOut':
      return isRequestClosedOrTimedOut;
    case 'idp.requestChallengeAfterBlockchain':
      return idp.requestChallengeAfterBlockchain;
    case 'idp.createResponseAfterBlockchain':
      return idp.createResponseAfterBlockchain;
    case 'idp.processIdpResponseAfterAddAccessor':
      return idp.processIdpResponseAfterAddAccessor;
    case 'as.afterGotDataFromCallback':
      return as.afterGotDataFromCallback;
    case 'as.registerOrUpdateASServiceInternalAsyncAfterBlockchain':
      return as.registerOrUpdateASServiceInternalAsyncAfterBlockchain;
    case 'as.processDataForRPInternalAsyncAfterBlockchain':
      return as.processDataForRPInternalAsyncAfterBlockchain;
    case 'identity.updateIalInternalAsyncAfterBlockchain':
      return identity.updateIalInternalAsyncAfterBlockchain;
    case 'identity.createIdentityInternalAsyncAfterCreateRequestBlockchain':
      return identity.createIdentityInternalAsyncAfterCreateRequestBlockchain;
    case 'identity.createIdentityInternalAsyncAfterBlockchain':
      return identity.createIdentityInternalAsyncAfterBlockchain;
    case 'identity.createIdentityInternalAsyncAfterExistedIdentityCheckBlockchain':
      return identity.createIdentityInternalAsyncAfterExistedIdentityCheckBlockchain;
    case 'identity.checkForExistedIdentityAfterBlockchain':
      return identity.checkForExistedIdentityAfterBlockchain;
    case 'identity.createIdentityInternalAsyncAfterClearRegisterIdentityTimeout':
      return identity.createIdentityInternalAsyncAfterClearRegisterIdentityTimeout;
    case 'identity.addAccessorAfterConsentAfterAddAccessorMethod':
      return identity.addAccessorAfterConsentAfterAddAccessorMethod;
    case 'identity.addAccessorAfterConsentAfterRegisterMqDest':
      return identity.addAccessorAfterConsentAfterRegisterMqDest;
    case 'identity.notifyResultOfCreateRequestToRevokeIdentity':
      return identity.notifyResultOfCreateRequestToRevokeIdentity;
    case 'identity.notifyRevokeAccessorAfterConsent':
      return identity.notifyRevokeAccessorAfterConsent;
    case 'idp.processIdpResponseAfterRevokeAccessor':
      return idp.processIdpResponseAfterRevokeAccessor;
    default:
      throw new CustomError({
        message: 'Unknown function name',
        details: {
          fnName,
        },
      });
  }
}

async function resumeTimeoutScheduler() {
  let scheduler = await cacheDb.getAllTimeoutScheduler();
  scheduler.forEach(({ requestId, unixTimeout }) =>
    runTimeoutScheduler(requestId, (unixTimeout - Date.now()) / 1000)
  );
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

async function handleMessageQueueError(error) {
  const err = new CustomError({
    message: 'Message queue receiving error',
    cause: error,
  });
  logger.error(err.getInfoForLog());
  let callbackUrl;
  if (role === 'rp') {
    callbackUrl = rp.getErrorCallbackUrl();
  } else if (role === 'idp') {
    callbackUrl = idp.getErrorCallbackUrl();
  } else if (role === 'as') {
    callbackUrl = as.getErrorCallbackUrl();
  }
  await notifyError({
    callbackUrl,
    action: 'onMessage',
    error: err,
  });
}

export async function getIdpsMsqDestination({
  namespace,
  identifier,
  min_ial,
  min_aal,
  idp_id_list,
  mode,
}) {
  const idpNodes = await tendermintNdid.getIdpNodesInfo({
    namespace: mode === 3 ? namespace : undefined,
    identifier: mode === 3 ? identifier : undefined,
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
      nodeId
    );
  } catch (error) {
    logger.error({
      message: 'Cannot set timed out',
      requestId,
      error,
    });
    throw error;
  }
  cacheDb.removeTimeoutScheduler(nodeId, requestId);
}

export function runTimeoutScheduler(nodeId, requestId, secondsToTimeout) {
  if (secondsToTimeout < 0) {
    timeoutRequest(nodeId, requestId);
  } else {
    timeoutScheduler[`${nodeId}:${requestId}`] = lt.setTimeout(() => {
      timeoutRequest(nodeId, requestId);
    }, secondsToTimeout * 1000);
  }
}

export async function setTimeoutScheduler(nodeId, requestId, secondsToTimeout) {
  let unixTimeout = Date.now() + secondsToTimeout * 1000;
  await cacheDb.setTimeoutScheduler(nodeId, requestId, unixTimeout);
  runTimeoutScheduler(nodeId, requestId, secondsToTimeout);
}

export async function removeTimeoutScheduler(nodeId, requestId) {
  lt.clearTimeout(timeoutScheduler[`${nodeId}:${requestId}`]);
  await cacheDb.removeTimeoutScheduler(nodeId, requestId);
  delete timeoutScheduler[`${nodeId}:${requestId}`];
}

async function verifyZKProof({
  request_id,
  idp_id,
  requestData,
  response,
  accessor_public_key,
  privateProofObject,
  challenge,
  mode,
  nodeId,
}) {
  //THIS FUNCTION CHECK ACCESSOR_GROUP_ID AGAINST OTHER RESPONES BEFORE VERIFY ACTUAL ZK-PROOK
  const { namespace, identifier } = requestData;
  const privateProofObjectList = await cacheDb.getPrivateProofObjectListInRequest(
    nodeId,
    requestData.request_id
  );

  if (mode === 1) {
    return null;
  }

  logger.debug({
    message: 'Verifying zk proof',
    request_id,
    idp_id,
    challenge,
    privateProofObject,
    mode,
  });

  //query accessor_group_id of this accessor_id
  const accessor_group_id = await tendermintNdid.getAccessorGroupId(
    privateProofObject.accessor_id
  );

  logger.debug({
    message: 'Verifying zk proof',
    privateProofObjectList,
  });

  //and check against all accessor_group_id of responses
  for (let i = 0; i < privateProofObjectList.length; i++) {
    let otherPrivateProofObject = privateProofObjectList[i].privateProofObject;
    let otherGroupId = await tendermintNdid.getAccessorGroupId(
      otherPrivateProofObject.accessor_id
    );
    if (otherGroupId !== accessor_group_id) {
      logger.debug({
        message: 'Conflict response',
        otherGroupId,
        otherPrivateProofObject,
        accessor_group_id,
        accessorId: privateProofObject.accessor_id,
      });

      throw new CustomError({
        errorType: errorType.DIFFERENT_ACCESSOR_GROUP_ID,
        details: {
          accessorId: privateProofObject.accessor_id,
          accessor_group_id,
          otherGroupId,
        },
      });
    }
  }

  const publicProof = JSON.parse(response.identity_proof);
  const privateProofValueHash = response.private_proof_hash;

  return utils.verifyZKProof(
    accessor_public_key,
    challenge,
    privateProofObject.privateProofValueArray,
    publicProof,
    {
      namespace,
      identifier,
    },
    privateProofValueHash,
    privateProofObject.padding
  );
}

//===== zkp and request related =====

export async function handleChallengeRequest({
  nodeId,
  request_id,
  idp_id,
  public_proof,
}) {
  logger.debug({
    message: 'Handle challenge request',
    nodeId,
    request_id,
    idp_id,
    public_proof,
  });

  //const [request_id, idp_id] = responseId.split(':');

  //get public proof in blockchain
  const public_proof_blockchain = JSON.parse(
    await tendermintNdid.getIdentityProof(request_id, idp_id)
  );

  //check public proof in blockchain and in message queue
  if (public_proof_blockchain.length !== public_proof.length) return;
  for (let i = 0; i < public_proof.length; i++) {
    if (public_proof_blockchain[i] !== public_proof[i]) return;
  }

  //if match, send challenge and return
  const nodeIdObj = {};

  let nodeRole;
  if (role === 'proxy') {
    const nodeInfo = await tendermintNdid.getNodeInfo(nodeId);
    nodeRole = nodeInfo.role.toLowerCase();
  } else {
    nodeRole = role;
  }

  if (nodeRole === 'idp') {
    nodeIdObj.idp_id = nodeId;
  } else if (nodeRole === 'rp') {
    nodeIdObj.rp_id = nodeId;
  }

  let challenge;
  let challengeObject = (await cacheDb.getRequestData(nodeId, request_id))
    .challenge;
  //no challenge found
  if (challengeObject == null || !challengeObject[idp_id]) return;
  challenge = challengeObject[idp_id];

  logger.debug({
    message: 'Get challenge',
    challenge,
  });

  const nodeInfo = await tendermintNdid.getNodeInfo(idp_id);
  if (nodeInfo == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: {
        request_id,
      },
    });
  }

  let receivers;
  if (nodeInfo.proxy != null) {
    if (nodeInfo.proxy.mq == null) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id,
          nodeId: idp_id,
        },
      });
    }
    receivers = [
      {
        node_id: idp_id,
        public_key: nodeInfo.public_key,
        proxy: {
          node_id: nodeInfo.proxy.node_id,
          public_key: nodeInfo.proxy.public_key,
          ip: nodeInfo.proxy.mq[0].ip,
          port: nodeInfo.proxy.mq[0].port,
          config: nodeInfo.proxy.config,
        },
      },
    ];
  } else {
    if (nodeInfo.mq == null) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id,
          nodeId: idp_id,
        },
      });
    }
    receivers = [
      {
        node_id: idp_id,
        public_key: nodeInfo.public_key,
        ip: nodeInfo.mq[0].ip,
        port: nodeInfo.mq[0].port,
      },
    ];
  }
  mq.send(
    receivers,
    {
      type: privateMessageType.CHALLENGE_RESPONSE,
      challenge,
      request_id,
      ...nodeIdObj,
      height: tendermint.latestBlockHeight,
    },
    nodeId
  );
}

export async function checkIdpResponse({
  nodeId,
  requestStatus,
  idpId,
  responseIal,
  requestDataFromMq,
}) {
  logger.debug({
    message: 'Checking IdP response (ZK Proof, IAL)',
    requestStatus,
    idpId,
    responseIal,
    requestDataFromMq,
  });

  let validIal;

  const requestId = requestStatus.request_id;

  // Check IAL
  const requestData = await cacheDb.getRequestData(nodeId, requestId);
  const identityInfo = await tendermintNdid.getIdentityInfo(
    requestData.namespace,
    requestData.identifier,
    idpId
  );

  if (requestStatus.mode === 1) {
    validIal = null; // Cannot check in mode 1
  } else if (requestStatus.mode === 3) {
    if (responseIal === identityInfo.ial) {
      validIal = true;
    } else {
      validIal = false;
    }
  }

  const privateProofObject = requestDataFromMq
    ? requestDataFromMq
    : await cacheDb.getPrivateProofReceivedFromMQ(
        nodeId,
        nodeId + ':' + requestStatus.request_id + ':' + idpId
      );

  const accessor_public_key = await tendermintNdid.getAccessorKey(
    privateProofObject.accessor_id
  );

  let validProof, signatureValid;
  if(accessor_public_key) {
    const response_list = (await tendermintNdid.getRequestDetail({
      requestId: requestStatus.request_id,
    })).response_list;
    const response = response_list.find((response) => response.idp_id === idpId);

    // Check ZK Proof
    const challenge = (await cacheDb.getRequestData(
      nodeId,
      requestStatus.request_id
    )).challenge[idpId];
    validProof = await verifyZKProof({
      request_id: requestStatus.request_id,
      idp_id: idpId,
      requestData,
      response,
      accessor_public_key,
      privateProofObject,
      challenge,
      mode: requestStatus.mode,
      nodeId,
    });

    logger.debug({
      message: 'Checked ZK proof and IAL',
      requestId,
      idpId,
      validProof,
      validIal,
    });

    // Check signature
    if (requestStatus.mode === 1) {
      signatureValid = null; // Cannot check in mode 1
    } else if (requestStatus.mode === 3) {
      const { request_message, initial_salt, request_id } = requestData;
      const signature = response.signature;

      logger.debug({
        message: 'Verifying signature',
        request_message,
        initial_salt,
        accessor_public_key,
        signature,
      });

      signatureValid = utils.verifyResponseSignature(
        signature,
        accessor_public_key,
        request_message,
        initial_salt,
        request_id
      );
    }
  } else {
    
    logger.debug({
      message: 'Accessor key not found or in active',
      accessorId: privateProofObject.accessor_id,
      idpId,
    });

    validProof = false;
    signatureValid = false;
  }

  const responseValid = {
    idp_id: idpId,
    valid_signature: signatureValid,
    valid_proof: validProof,
    valid_ial: validIal,
  };

  await cacheDb.addIdpResponseValidList(nodeId, requestId, responseValid);

  cacheDb.removePrivateProofReceivedFromMQ(
    nodeId,
    `${nodeId}:${requestStatus.request_id}:${idpId}`
  );

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
  callbackUrl,
  action,
  error,
  requestId,
}) {
  logger.debug({
    message: 'Notifying error through callback',
  });
  if (callbackUrl == null) {
    logger.warn({
      message: 'Error callback URL has not been set',
    });
    return;
  }
  await callbackToClient(
    callbackUrl,
    {
      node_id: nodeId,
      type: 'error',
      action,
      request_id: requestId,
      error: getErrorObjectForClient(error),
    },
    false
  );
}
