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

import CustomError from '../error/custom_error';
import logger from '../logger';

import * as tendermint from '../tendermint';
import * as tendermintNdid from '../tendermint/ndid';
import * as rp from './rp';
import * as idp from './idp';
import * as as from './as';
import * as mq from '../mq';
import {
  setShouldRetryFnGetter,
  setResponseCallbackFnGetter,
  resumeCallbackToClient,
  callbackToClient,
} from '../utils/callback';
import * as utils from '../utils';
import * as lt from '../utils/long_timeout';
import * as config from '../config';
import errorType from '../error/type';
import { getErrorObjectForClient } from '../error/helpers';
import * as db from '../db';
import * as externalCryptoService from '../utils/external_crypto_service';

const role = config.role;

let messageQueueAddressRegistered = !config.registerMqAtStartup;
let handleMessageFromQueue;

export function registeredMsqAddress() {
  return messageQueueAddressRegistered;
}

async function registerMessageQueueAddress() {
  if (!messageQueueAddressRegistered) {
    //query current self msq
    const selfMqAddress = await tendermintNdid.getMsqAddress(config.nodeId);
    if (selfMqAddress) {
      const { ip, port } = selfMqAddress;
      //if not same
      if (ip !== config.mqRegister.ip || port !== config.mqRegister.port) {
        //work only for broadcast tx commit
        await tendermintNdid.registerMsqAddress(config.mqRegister);
      }
    } else {
      //work only for broadcast tx commit
      await tendermintNdid.registerMsqAddress(config.mqRegister);
    }
    messageQueueAddressRegistered = true;
  }
}

if (role === 'rp' || role === 'idp' || role === 'as') {
  tendermint.eventEmitter.on('ready', () => {
    if (
      !config.useExternalCryptoService ||
      (config.useExternalCryptoService &&
        externalCryptoService.isCallbackUrlsSet())
    ) {
      registerMessageQueueAddress();
    }
  });

  if (config.useExternalCryptoService) {
    externalCryptoService.eventEmitter.on('allCallbacksSet', () => {
      if (tendermint.syncing === false) {
        registerMessageQueueAddress();
      }
    });
  }
}

if (role === 'rp') {
  handleMessageFromQueue = rp.handleMessageFromQueue;
  tendermint.setTendermintNewBlockEventHandler(
    rp.handleTendermintNewBlockEvent
  );
  setShouldRetryFnGetter(rp.getShouldRetryFn);
  setResponseCallbackFnGetter(rp.getResponseCallbackFn);
  resumeTimeoutScheduler();
  resumeCallbackToClient();
} else if (role === 'idp') {
  handleMessageFromQueue = idp.handleMessageFromQueue;
  tendermint.setTendermintNewBlockEventHandler(
    idp.handleTendermintNewBlockEvent
  );
  setShouldRetryFnGetter(idp.getShouldRetryFn);
  setResponseCallbackFnGetter(idp.getResponseCallbackFn);
  resumeTimeoutScheduler();
  resumeCallbackToClient();
} else if (role === 'as') {
  handleMessageFromQueue = as.handleMessageFromQueue;
  tendermint.setTendermintNewBlockEventHandler(
    as.handleTendermintNewBlockEvent
  );
  setShouldRetryFnGetter(as.getShouldRetryFn);
  setResponseCallbackFnGetter(as.getResponseCallbackFn);
  resumeCallbackToClient();
}

async function resumeTimeoutScheduler() {
  let scheduler = await db.getAllTimeoutScheduler();
  scheduler.forEach(({ requestId, unixTimeout }) =>
    runTimeoutScheduler(requestId, (unixTimeout - Date.now()) / 1000)
  );
}

export async function checkRequestMessageIntegrity(
  requestId,
  request,
  requestDetail
) {
  if (!requestDetail) {
    requestDetail = await tendermintNdid.getRequestDetail({ requestId });
  }

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

export async function checkDataRequestParamsIntegrity(
  requestId,
  request,
  requestDetail
) {
  if (!requestDetail) {
    requestDetail = await tendermintNdid.getRequestDetail({ requestId });
  }

  for (let i = 0; i < requestDetail.data_request_list.length; i++) {
    const dataRequest = requestDetail.data_request_list[i];
    const dataRequestParamsHash = utils.hash(
      request.data_request_list[i].request_params +
        request.data_request_params_salt_list[i]
    );
    const dataRequestParamsValid =
      dataRequest.request_params_hash === dataRequestParamsHash;
    if (!dataRequestParamsValid) {
      logger.warn({
        message: 'Request data request params hash mismatched',
        requestId,
      });
      logger.debug({
        message: 'Request data request params hash mismatched',
        requestId,
        givenRequestParams: dataRequest.request_params,
        givenRequestParamsHashWithSalt: dataRequestParamsHash,
        requestParamsHashFromBlockchain: dataRequest.request_params_hash,
      });
      return false;
    }
  }
  return true;
}

export async function checkRequestIntegrity(requestId, request) {
  const requestDetail = await tendermintNdid.getRequestDetail({ requestId });

  const requestMessageValid = checkRequestMessageIntegrity(
    requestId,
    request,
    requestDetail
  );

  const dataRequestParamsValid = checkDataRequestParamsIntegrity(
    requestId,
    request,
    requestDetail
  );

  return requestMessageValid && dataRequestParamsValid;
}

async function handleMessageQueueError(error) {
  const err = new CustomError({
    message: 'Message queue receiving error',
    cause: error,
  });
  logger.error(err.getInfoForLog());
  let callbackUrl;
  if (config.role === 'rp') {
    callbackUrl = rp.getErrorCallbackUrl();
  } else if (config.role === 'idp') {
    callbackUrl = idp.getErrorCallbackUrl();
  } else if (config.role === 'as') {
    callbackUrl = as.getErrorCallbackUrl();
  }
  await notifyError({
    callbackUrl,
    action: 'onMessage',
    error: err,
  });
}

if (handleMessageFromQueue) {
  mq.eventEmitter.on('message', handleMessageFromQueue);
}
mq.eventEmitter.on('error', handleMessageQueueError);

export async function getIdpsMsqDestination({
  namespace,
  identifier,
  min_ial,
  min_aal,
  idp_id_list,
  mode,
}) {
  const idpNodes = await tendermintNdid.getIdpNodes({
    namespace: mode === 3 ? namespace : undefined,
    identifier: mode === 3 ? identifier : undefined,
    min_ial,
    min_aal,
  });

  let filteredIdpNodes;
  if (idp_id_list != null && idp_id_list.length !== 0) {
    filteredIdpNodes = idpNodes.filter(
      (idpNode) => idp_id_list.indexOf(idpNode.node_id) >= 0
    );
  } else {
    filteredIdpNodes = idpNodes;
  }

  const receivers = (await Promise.all(
    filteredIdpNodes.map(async (idpNode) => {
      const nodeId = idpNode.node_id;
      const mqAddress = await tendermintNdid.getMsqAddress(nodeId);
      if (mqAddress == null) {
        return null;
      }
      return {
        idp_id: nodeId,
        ip: mqAddress.ip,
        port: mqAddress.port,
        ...(await tendermintNdid.getNodePubKey(nodeId)),
      };
    })
  )).filter((receiver) => receiver != null);
  return receivers;
}

//=========================================== Request related ========================================

export let timeoutScheduler = {};

export function clearAllScheduler() {
  for (let requestId in timeoutScheduler) {
    lt.clearTimeout(timeoutScheduler[requestId]);
  }
}

export async function timeoutRequest(requestId) {
  try {
    const responseValidList = await db.getIdpResponseValidList(requestId);

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

    await tendermintNdid.timeoutRequest({ requestId, responseValidList });
  } catch (error) {
    logger.error({
      message: 'Cannot set timed out',
      requestId,
      error,
    });
    throw error;
  }
  db.removeTimeoutScheduler(requestId);
  db.removeChallengeFromRequestId(requestId);
}

export function runTimeoutScheduler(requestId, secondsToTimeout) {
  if (secondsToTimeout < 0) timeoutRequest(requestId);
  else {
    timeoutScheduler[requestId] = lt.setTimeout(() => {
      timeoutRequest(requestId);
    }, secondsToTimeout * 1000);
  }
}

export async function addTimeoutScheduler(requestId, secondsToTimeout) {
  let unixTimeout = Date.now() + secondsToTimeout * 1000;
  await db.addTimeoutScheduler(requestId, unixTimeout);
  runTimeoutScheduler(requestId, secondsToTimeout);
}

/**
 * Create a new request
 * @param {Object} request
 * @param {number} request.mode
 * @param {string} request.namespace
 * @param {string} request.reference_id
 * @param {Array.<string>} request.idp_id_list
 * @param {string} request.callback_url
 * @param {Array.<Object>} request.data_request_list
 * @param {string} request.request_message
 * @param {number} request.min_ial
 * @param {number} request.min_aal
 * @param {number} request.min_idp
 * @param {number} request.request_timeout
 * @returns {Promise<string>} Request ID
 */
export async function createRequest(
  {
    request_id, // Pre-generated request ID. Used by create identity function.
    mode,
    namespace,
    identifier,
    reference_id,
    idp_id_list,
    callback_url,
    data_request_list,
    request_message,
    min_ial,
    min_aal,
    min_idp,
    request_timeout,
  },
  { synchronous = false } = {}
) {
  try {
    // existing reference_id, return request ID
    const requestId = await db.getRequestIdByReferenceId(reference_id);
    if (requestId) {
      return requestId;
    }

    if (
      idp_id_list != null &&
      idp_id_list.length > 0 &&
      idp_id_list.length < min_idp
    ) {
      throw new CustomError({
        message: errorType.IDP_LIST_LESS_THAN_MIN_IDP.message,
        code: errorType.IDP_LIST_LESS_THAN_MIN_IDP.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
          min_idp,
        },
      });
    }

    if (mode === 1 && (idp_id_list == null || idp_id_list.length === 0)) {
      throw new CustomError({
        message: errorType.IDP_ID_LIST_NEEDED.message,
        code: errorType.IDP_ID_LIST_NEEDED.code,
        clientError: true,
      });
    }

    if (data_request_list != null && data_request_list.length > 0) {
      const serviceIds = [];
      for (let i = 0; i < data_request_list.length; i++) {
        const { service_id, as_id_list, min_as } = data_request_list[i];

        if (serviceIds.includes(service_id)) {
          throw new CustomError({
            message: errorType.DUPLICATE_SERVICE_ID.message,
            code: errorType.DUPLICATE_SERVICE_ID.code,
            clientError: true,
            details: {
              index: i,
              service_id,
            },
          });
        }
        serviceIds.push(service_id);

        //all as_list offer the service
        let potential_as_list = await tendermintNdid.getAsNodesByServiceId({
          service_id,
        });
        if (as_id_list != null && as_id_list.length > 0) {
          if (as_id_list.length < min_as) {
            throw new CustomError({
              message: errorType.AS_LIST_LESS_THAN_MIN_AS.message,
              code: errorType.AS_LIST_LESS_THAN_MIN_AS.code,
              clientError: true,
              details: {
                service_id,
                as_id_list,
                min_as,
              },
            });
          }

          if (potential_as_list.length < min_as) {
            throw new CustomError({
              message: errorType.NOT_ENOUGH_AS.message,
              code: errorType.NOT_ENOUGH_AS.code,
              clientError: true,
              details: {
                service_id,
                potential_as_list,
                min_as,
              },
            });
          }

          //filter potential AS to be only in as_id_list
          potential_as_list = potential_as_list.filter((as_node) => {
            return as_id_list.indexOf(as_node.node_id) !== -1;
          });
        }
        //filter min_ial, min_aal
        potential_as_list = potential_as_list.filter((as_node) => {
          return as_node.min_ial <= min_ial && as_node.min_aal <= min_aal;
        });

        if (potential_as_list.length < min_as) {
          throw new CustomError({
            message: errorType.CONDITION_TOO_LOW.message,
            code: errorType.CONDITION_TOO_LOW.code,
            clientError: true,
            details: {
              service_id,
              min_ial,
              min_aal,
              min_as,
            },
          });
        }
      }
    }

    let receivers = await getIdpsMsqDestination({
      namespace,
      identifier,
      min_ial,
      min_aal,
      idp_id_list,
      mode,
    });

    if (receivers.length === 0 && min_idp !== 0) {
      throw new CustomError({
        message: errorType.NO_IDP_FOUND.message,
        code: errorType.NO_IDP_FOUND.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
        },
      });
    }

    if (receivers.length < min_idp) {
      throw new CustomError({
        message: errorType.NOT_ENOUGH_IDP.message,
        code: errorType.NOT_ENOUGH_IDP.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
        },
      });
    }

    if (request_id == null) {
      request_id = utils.createRequestId();
    }

    const challenge = [
      utils.randomBase64Bytes(config.challengeLength),
      utils.randomBase64Bytes(config.challengeLength),
    ];
    db.setChallengeFromRequestId(request_id, challenge);

    const request_message_salt = utils.randomBase64Bytes(16);

    const data_request_params_salt_list = data_request_list.map(() => {
      return utils.randomBase64Bytes(16);
    });

    const requestData = {
      mode,
      namespace,
      identifier,
      request_id,
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list,
      data_request_params_salt_list,
      request_message,
      // for zk proof
      //challenge,
      rp_id: config.nodeId,
      request_message_salt,
    };

    // save request data to DB to send to AS via mq when authen complete
    // and for zk proof
    await db.setRequestData(request_id, requestData);

    // maintain mapping
    await db.setRequestIdByReferenceId(reference_id, request_id);
    await db.setRequestCallbackUrl(request_id, callback_url);

    await addTimeoutScheduler(request_id, request_timeout);

    if (synchronous) {
      await createRequestInternalAsync(...arguments, {
        request_id,
        request_message_salt,
        data_request_params_salt_list,
        receivers,
        requestData,
      });
    } else {
      createRequestInternalAsync(...arguments, {
        request_id,
        request_message_salt,
        data_request_params_salt_list,
        receivers,
        requestData,
      });
    }

    return request_id;
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create request',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function createRequestInternalAsync(
  {
    mode,
    namespace,
    identifier,
    reference_id,
    idp_id_list,
    callback_url,
    data_request_list,
    request_message,
    min_ial,
    min_aal,
    min_idp,
    request_timeout,
  },
  { synchronous = false } = {},
  {
    request_id,
    request_message_salt,
    data_request_params_salt_list,
    receivers,
    requestData,
  }
) {
  try {
    const dataRequestListToBlockchain = data_request_list.map(
      (dataRequest, index) => {
        return {
          service_id: dataRequest.service_id,
          as_id_list: dataRequest.as_id_list,
          min_as: dataRequest.min_as,
          request_params_hash: utils.hash(
            dataRequest.request_params + data_request_params_salt_list[index]
          ),
        };
      }
    );

    const requestDataToBlockchain = {
      mode,
      request_id,
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list: dataRequestListToBlockchain,
      request_message_hash: utils.hash(request_message + request_message_salt),
    };

    const { height } = await tendermintNdid.createRequest(
      requestDataToBlockchain
    );

    // send request data to IDPs via message queue
    if (min_idp > 0) {
      mq.send(receivers, {
        type: 'consent_request',
        ...requestData,
        height,
      });
    }

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'create_request_result',
          success: true,
          reference_id,
          request_id,
        },
        true
      );
    }
  } catch (error) {
    await db.removeRequestIdByReferenceId(reference_id);
    await db.removeRequestCallbackUrl(request_id);

    logger.error({
      message: 'Create request internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'create_request_result',
          success: false,
          reference_id,
          request_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}

export async function verifyZKProof(request_id, idp_id, dataFromMq, mode) {
  const {
    namespace,
    identifier,
    privateProofObjectList,
    request_message,
    request_message_salt,
  } = await db.getRequestData(request_id);

  if (mode === 1) {
    return null;
  }

  const challenge = await db.getChallengeFromRequestId(request_id);
  const privateProofObject = dataFromMq
    ? dataFromMq
    : await db.getPrivateProofReceivedFromMQ(request_id + ':' + idp_id);

  logger.debug({
    message: 'Verifying zk proof',
    request_id,
    idp_id,
    dataFromMq,
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
        message: errorType.DIFFERENT_ACCESSOR_GROUP_ID.message,
        code: errorType.DIFFERENT_ACCESSOR_GROUP_ID.code,
        details: {
          accessorId: privateProofObject.accessor_id,
          accessor_group_id,
          otherGroupId,
        },
      });
    }
  }

  //query accessor_public_key from privateProofObject.accessor_id
  const public_key = await tendermintNdid.getAccessorKey(
    privateProofObject.accessor_id
  );

  //query publicProof from response of idp_id in request
  const response_list = (await tendermintNdid.getRequestDetail({
    requestId: request_id,
  })).response_list;

  logger.debug({
    message: 'Request detail',
    response_list,
    request_message,
  });

  const response = response_list.find((response) => response.idp_id === idp_id);
  const publicProof = JSON.parse(response.identity_proof);
  const signature = response.signature;
  const privateProofValueHash = response.private_proof_hash;

  const signatureValid = utils.verifySignature(
    signature,
    public_key,
    request_message + request_message_salt
  );

  logger.debug({
    message: 'Verify signature',
    signatureValid,
    request_message,
    request_message_salt,
    public_key,
    signature,
  });

  return (
    signatureValid &&
    utils.verifyZKProof(
      public_key,
      challenge,
      privateProofObject.privateProofValueArray,
      publicProof,
      {
        namespace,
        identifier,
      },
      privateProofValueHash,
      privateProofObject.padding
    )
  );
}

//===== zkp and request related =====

export async function handleChallengeRequest({
  request_id,
  idp_id,
  public_proof,
}) {
  logger.debug({
    message: 'Handle challenge request',
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
  if (public_proof_blockchain.length !== public_proof.length) return false;
  for (let i = 0; i < public_proof.length; i++) {
    if (public_proof_blockchain[i] !== public_proof[i]) return false;
  }

  //if match, send challenge and return
  const nodeId = {};
  if (config.role === 'idp') nodeId.idp_id = config.nodeId;
  else if (config.role === 'rp') nodeId.rp_id = config.nodeId;
  const challenge = await db.getChallengeFromRequestId(request_id);
  logger.debug({
    message: 'Get challenge',
    challenge,
  });
  //challenge deleted, request is done
  if (challenge == null) return false;

  const mqAddress = await tendermintNdid.getMsqAddress(idp_id);
  if (mqAddress == null) {
    throw new CustomError({
      message: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND.message,
      code: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND.code,
      details: {
        request_id,
      },
    });
  }
  const { ip, port } = mqAddress;
  const receiver = [
    {
      ip,
      port,
      ...(await tendermintNdid.getNodePubKey(idp_id)),
    },
  ];
  mq.send(receiver, {
    type: 'challenge_response',
    challenge,
    request_id,
    ...nodeId,
  });
}

export async function checkIdpResponse({
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
  const requestData = await db.getRequestData(requestId);
  const identityInfo = await tendermintNdid.getIdentityInfo(
    requestData.namespace,
    requestData.identifier,
    idpId
  );

  if (requestStatus.mode === 1) {
    validIal = null; // Cannot check in mode 1
  } else if (requestStatus.mode === 3) {
    if (responseIal <= identityInfo.ial) {
      validIal = true;
    } else {
      validIal = false;
    }
  }

  // Check ZK Proof
  const validProof = await verifyZKProof(
    requestStatus.request_id,
    idpId,
    requestDataFromMq,
    requestStatus.mode
  );

  logger.debug({
    message: 'Checked ZK proof and IAL',
    requestId,
    idpId,
    validProof,
    validIal,
  });

  const responseValid = {
    idp_id: idpId,
    valid_proof: validProof,
    valid_ial: validIal,
  };

  await db.addIdpResponseValidList(requestId, responseValid);

  db.removePrivateProofReceivedFromMQ(`${requestStatus.request_id}:${idpId}`);

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

export async function closeRequest(
  { reference_id, callback_url, request_id },
  { synchronous = false } = {}
) {
  try {
    if (synchronous) {
      await closeRequestInternalAsync(...arguments);
    } else {
      closeRequestInternalAsync(...arguments);
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot close a request',
      reference_id,
      callback_url,
      request_id,
      synchronous,
      cause: error,
    });
  }
}

async function closeRequestInternalAsync(
  { reference_id, callback_url, request_id },
  { synchronous = false } = {}
) {
  try {
    const responseValidList = await db.getIdpResponseValidList(request_id);

    // FOR DEBUG
    const nodeIds = {};
    for (let i = 0; i < responseValidList.length; i++) {
      if (nodeIds[responseValidList[i].idp_id]) {
        logger.error({
          message: 'Duplicate IdP ID in response valid list',
          requestId: request_id,
          responseValidList,
          action: 'closeRequest',
        });
        break;
      }
      nodeIds[responseValidList[i].idp_id] = true;
    }

    await tendermintNdid.closeRequest({
      requestId: request_id,
      responseValidList,
    });

    db.removeChallengeFromRequestId(request_id);

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'close_request_result',
          success: true,
          reference_id,
          request_id,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: 'Close request internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'close_request_result',
          success: false,
          reference_id,
          request_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}

export async function notifyError({ callbackUrl, action, error, requestId }) {
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
      type: 'error',
      action,
      request_id: requestId,
      error: getErrorObjectForClient(error),
    },
    false
  );
}
