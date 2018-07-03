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

import CustomError from '../error/customError';
import logger from '../logger';

import * as tendermint from '../tendermint';
import * as tendermintNdid from '../tendermint/ndid';
import * as rp from './rp';
import * as idp from './idp';
import * as as from './as';
import { eventEmitter as messageQueueEvent } from '../mq';
import { resumeCallbackToClient } from '../utils/callback';
import * as utils from '../utils';
import * as config from '../config';
import errorType from '../error/type';
import * as mq from '../mq';
import * as db from '../db';
import * as externalCryptoService from '../utils/externalCryptoService';

const role = config.role;

let messageQueueAddressRegistered = false;
let handleMessageFromQueue;

function registerMessageQueueAddress() {
  if (!messageQueueAddressRegistered) {
    tendermintNdid.registerMsqAddress(config.mqRegister);
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
  tendermint.setTendermintNewBlockHeaderEventHandler(
    rp.handleTendermintNewBlockHeaderEvent
  );
  resumeTimeoutScheduler();
  resumeCallbackToClient();
} else if (role === 'idp') {
  handleMessageFromQueue = idp.handleMessageFromQueue;
  tendermint.setTendermintNewBlockHeaderEventHandler(
    idp.handleTendermintNewBlockHeaderEvent
  );
  resumeTimeoutScheduler();
  resumeCallbackToClient(shouldRetryCallback);
} else if (role === 'as') {
  handleMessageFromQueue = as.handleMessageFromQueue;
  tendermint.setTendermintNewBlockHeaderEventHandler(
    as.handleTendermintNewBlockHeaderEvent
  );
  resumeCallbackToClient(shouldRetryCallback, as.afterGotDataFromCallback);
}

async function resumeTimeoutScheduler() {
  let scheduler = await db.getAllTimeoutScheduler();
  scheduler.forEach(({ requestId, unixTimeout }) =>
    runTimeoutScheduler(requestId, (unixTimeout - Date.now()) / 1000)
  );
}

export async function checkRequestIntegrity(requestId, request) {
  const msgBlockchain = await tendermintNdid.getRequest({ requestId });

  const valid =
    utils.hash(request.secretSalt + request.request_message) ===
    msgBlockchain.request_message_hash;
  /*utils.compareSaltedHash({
    saltedHash: msgBlockchain.messageHash,
    plain: request.request_message,
  });*/
  if (!valid) {
    logger.warn({
      message: 'Request message hash mismatched',
      requestId,
    });
    logger.debug({
      message: 'Request message hash mismatched',
      requestId,
      givenRequestMessage: request.request_message,
      givenRequestMessageHashWithSalt: utils.hash(
        request.secretSalt + request.request_message
      ),
      requestMessageHashFromBlockchain: msgBlockchain.request_message_hash,
    });
  }

  return valid;
}

if (handleMessageFromQueue) {
  messageQueueEvent.on('message', handleMessageFromQueue);
}

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
    clearTimeout(timeoutScheduler[requestId]);
  }
}

export async function timeoutRequest(requestId) {
  try {
    const responseValidList = await db.getIdpResponseValidList(requestId);

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
    timeoutScheduler[requestId] = setTimeout(() => {
      timeoutRequest(requestId);
    }, secondsToTimeout * 1000);
  }
}

export function addTimeoutScheduler(requestId, secondsToTimeout) {
  let unixTimeout = Date.now() + secondsToTimeout * 1000;
  db.addTimeoutScheduler(requestId, unixTimeout);
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
export async function createRequest({
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
}) {
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

    const request_id = utils.createRequestId();

    const dataRequestListToBlockchain = [];
    for (let i in data_request_list) {
      dataRequestListToBlockchain.push({
        service_id: data_request_list[i].service_id,
        as_id_list: data_request_list[i].as_id_list,
        min_as: data_request_list[i].min_as,
        request_params_hash: utils.hashWithRandomSalt(
          data_request_list[i].request_params
        ),
      });
    }

    let challenge = [
      utils.randomBase64Bytes(config.challengeLength),
      utils.randomBase64Bytes(config.challengeLength),
    ];
    db.setChallengeFromRequestId(request_id, challenge);

    let secretSalt = utils.randomBase64Bytes(16);

    const requestData = {
      mode,
      namespace,
      identifier,
      request_id,
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list: data_request_list,
      request_message,
      // for zk proof
      //challenge,
      rp_id: config.nodeId,
      secretSalt,
    };

    // save request data to DB to send to AS via mq when authen complete
    // store even no data require, use for zk proof
    //if (data_request_list != null && data_request_list.length !== 0) {
    await db.setRequestData(request_id, requestData);
    //}

    // add data to blockchain
    const requestDataToBlockchain = {
      mode,
      request_id,
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list: dataRequestListToBlockchain,
      request_message_hash: utils.hash(secretSalt + request_message),
    };

    // maintain mapping
    await db.setRequestIdByReferenceId(reference_id, request_id);
    await db.setRequestCallbackUrl(request_id, callback_url);

    try {
      const { height } = await tendermintNdid.createRequest(
        requestDataToBlockchain
      );

      // send request data to IDPs via message queue
      mq.send(receivers, {
        ...requestData,
        height,
      });
    } catch (error) {
      await db.removeRequestIdByReferenceId(reference_id);
      await db.removeRequestCallbackUrl(request_id);
      throw error;
    }

    addTimeoutScheduler(request_id, request_timeout);

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

export async function verifyZKProof(request_id, idp_id, dataFromMq, mode) {
  let {
    namespace,
    identifier,
    privateProofObjectList,
    request_message,
  } = await db.getRequestData(request_id);

  //check only signature of idp_id
  if (mode === 1) {
    return true;

    /*let response_list = (await getRequestDetail({
      requestId: request_id,
    })).response_list;
    for(let i = 0 ; i < response_list.length ; i++) {
      if(response_list[i].idp_id !== idp_id) continue;

      let { signature } = response_list[i];
      let { public_key } = await getNodePubKey(idp_id);

      logger.debug({
        message: 'Verify signature, mode 1',
        signature,
        public_key,
        request_message,
        idp_id,
      });

      if(!utils.verifySignature(signature, public_key, JSON.stringify(request_message))) return false;
      else return true;
    }
    //should not reach (idp_id not found)
    logger.debug({
      message: 'Code should never reach here (in common.verifyZKProof)',
      request_id, idp_id, dataFromMq, mode,
    });
    return false;*/
  }

  let challenge = await db.getChallengeFromRequestId(request_id);
  let privateProofObject = dataFromMq
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
  let accessor_group_id = await tendermintNdid.getAccessorGroupId(
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
      //TODO handle this, manually close?
      logger.debug({
        message: 'Conflict response',
        otherGroupId,
        otherPrivateProofObject,
        accessor_group_id,
        accessorId: privateProofObject.accessor_id,
      });
      throw 'Conflicted response';
    }
  }

  //query accessor_public_key from privateProofObject.accessor_id
  let public_key = await tendermintNdid.getAccessorKey(
    privateProofObject.accessor_id
  );

  //query publicProof from response of idp_id in request
  let publicProof, signature, privateProofValueHash;
  let response_list = (await tendermintNdid.getRequestDetail({
    requestId: request_id,
  })).response_list;

  logger.debug({
    message: 'Request detail',
    response_list,
    request_message,
  });

  response_list.forEach((response) => {
    if (response.idp_id === idp_id) {
      publicProof = JSON.parse(response.identity_proof);
      signature = response.signature;
      privateProofValueHash = response.private_proof_hash;
    }
  });

  let signatureValid = utils.verifySignature(
    signature,
    public_key,
    request_message
  );

  logger.debug({
    message: 'Verify signature',
    signatureValid,
    request_message,
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

export async function handleChallengeRequest(responseId) {
  logger.debug({
    message: 'Handle challenge request',
  });

  let [request_id, idp_id] = responseId.split(':');

  //get public proof from mq
  let public_proof_mq = await db.getPublicProofReceivedFromMQ(responseId);

  logger.debug({
    message: 'Public proof from MQ',
    public_proof_mq,
    responseId,
  });

  //message queue not arrived yet
  if (!public_proof_mq) return false;

  //get public proof in blockchain
  let public_proof_blockchain = JSON.parse(
    await tendermintNdid.getIdentityProof(request_id, idp_id)
  );
  if (!public_proof_blockchain) return false;

  //check public proof in blockchain and in message queue
  if (public_proof_blockchain.length !== public_proof_mq.length) return false;
  for (let i = 0; i < public_proof_mq.length; i++) {
    if (public_proof_blockchain[i] !== public_proof_mq[i]) return false;
  }

  //if match, send challenge and return
  let nodeId = {};
  if (config.role === 'idp') nodeId.idp_id = config.nodeId;
  else if (config.role === 'rp') nodeId.rp_id = config.nodeId;
  let challenge = await db.getChallengeFromRequestId(request_id);
  logger.debug({
    message: 'Get challenge',
    challenge,
  });
  //challenge deleted, request is done
  if (challenge == null) return false;

  let { ip, port } = await tendermintNdid.getMsqAddress(idp_id);
  let receiver = [
    {
      ip,
      port,
      ...(await tendermintNdid.getNodePubKey(idp_id)),
    },
  ];
  mq.send(receiver, {
    challenge,
    request_id,
    ...nodeId,
  });
}

/**
 * Returns false if request is closed or timed out
 * @param {string} requestId
 * @returns {boolean}
 */
export async function shouldRetryCallback(requestId) {
  if (requestId) {
    const requestDetail = await tendermintNdid.getRequestDetail({ requestId });
    if (requestDetail.closed || requestDetail.timed_out) {
      return false;
    }
  }
  return true;
}

export async function closeRequest(requestId) {
  try {
    const responseValidList = await db.getIdpResponseValidList(requestId);

    await tendermintNdid.closeRequest({
      requestId,
      responseValidList,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot close a request',
      requestId,
      cause: error,
    });
  }
  db.removeChallengeFromRequestId(requestId);
}
