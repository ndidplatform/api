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

import fs from 'fs';
import path from 'path';

import { callbackToClient } from '../utils/callback';
import CustomError from '../error/customError';
import logger from '../logger';

import * as tendermint from '../tendermint';
import * as tendermintNdid from '../tendermint/ndid';
import * as mq from '../mq';
import * as utils from '../utils';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';
import errorType from '../error/type';
import { getErrorObjectForClient } from '../error/helpers';

const callbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  config.dataDirectoryPath,
  'as-callback-url-' + config.nodeId
);

[{ key: 'error_url', fileSuffix: 'error' }].forEach(({ key, fileSuffix }) => {
  try {
    callbackUrls[key] = fs.readFileSync(
      callbackUrlFilesPrefix + '-' + fileSuffix,
      'utf8'
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn({
        message: `${fileSuffix} callback url file not found`,
      });
    } else {
      logger.error({
        message: `Cannot read ${fileSuffix} callback url file`,
        error,
      });
    }
  }
});

function writeCallbackUrlToFile(fileSuffix, url) {
  fs.writeFile(callbackUrlFilesPrefix + '-' + fileSuffix, url, (err) => {
    if (err) {
      logger.error({
        message: `Cannot write ${fileSuffix} callback url file`,
        error: err,
      });
    }
  });
}

export const setCallbackUrls = ({ error_url }) => {
  if (error_url != null) {
    callbackUrls.error_url = error_url;
    writeCallbackUrlToFile('error', error_url);
  }
};

export const getCallbackUrls = () => {
  return callbackUrls;
};

async function sendDataToRP(rpId, data) {
  let receivers = [];
  let nodeId = rpId;

  const mqAddress = await tendermintNdid.getMsqAddress(nodeId);
  if (mqAddress == null) {
    throw new CustomError({
      message: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND.message,
      code: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND.code,
      details: {
        request_id: data.request_id,
      },
    });
  }
  let { ip, port } = mqAddress;
  receivers.push({
    ip,
    port,
    ...(await tendermintNdid.getNodePubKey(nodeId)), // TODO: try catch / error handling
  });
  mq.send(receivers, {
    type: 'as_data_response',
    request_id: data.request_id,
    as_id: data.as_id,
    service_id: data.service_id,
    signature: data.signature,
    data: data.data,
    height: data.height,
  });
}

export async function processDataForRP(
  data,
  { reference_id, callback_url, requestId, serviceId, rpId },
  { synchronous = false } = {}
) {
  try {
    if (synchronous) {
      await processDataForRPInternalAsync(...arguments);
    } else {
      processDataForRPInternalAsync(...arguments);
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot send data to RP',
      reference_id,
      callback_url,
      requestId,
      serviceId,
      rpId,
      synchronous,
      cause: error,
    });
  }
}

async function processDataForRPInternalAsync(
  data,
  { reference_id, callback_url, requestId, serviceId, rpId },
  { synchronous = false } = {}
) {
  try {
    const as_id = config.nodeId;
    const signature = await utils.createSignature(data);

    // AS node adds transaction to blockchain
    const { height } = await tendermintNdid.signASData({
      as_id,
      request_id: requestId,
      signature,
      service_id: serviceId,
    });

    if (!rpId) {
      rpId = await db.getRPIdFromRequestId(requestId);
    }

    await sendDataToRP(rpId, {
      request_id: requestId,
      as_id,
      signature,
      service_id: serviceId,
      data,
      height,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'send_data_result',
          success: true,
          reference_id,
          request_id: requestId,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: 'Send data to RP internal async error',
      data,
      originalArgs: arguments[1],
      options: arguments[2],
      additionalArgs: arguments[3],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'send_data_result',
          success: false,
          reference_id,
          request_id: requestId,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}

export async function afterGotDataFromCallback(
  { response, body },
  additionalData
) {
  if (response.status === 204) {
    await db.setRPIdFromRequestId(
      additionalData.requestId,
      additionalData.rpId
    );
    return;
  }
  let data, synchronous;
  try {
    const result = JSON.parse(body);

    logger.info({
      message: 'Received data from AS',
    });
    logger.debug({
      message: 'Data from AS',
      result,
    });

    data = result.data;
    additionalData.reference_id = result.reference_id;
    additionalData.callback_url = result.callback_url;
    synchronous = !additionalData.reference_id || !additionalData.callback_url;
  } catch (error) {
    logger.error({
      message: 'Cannot parse data from AS',
      error,
    });

    throw new CustomError({
      message: 'Cannot parse data from AS',
      cause: error,
    });
  }
  processDataForRP(data, additionalData, { synchronous });
}

async function getDataAndSendBackToRP(request, responseDetails) {
  // Platform→AS
  // The AS replies with the requested data
  logger.debug({
    message: 'AS process request for data',
    request,
    responseDetails,
  });

  const callbackUrl = await db.getServiceCallbackUrl(request.service_id);

  if (!callbackUrl) {
    logger.error({
      message: 'Callback URL for AS has not been set',
    });
    return;
  }

  logger.info({
    message: 'Sending callback to AS',
  });
  logger.debug({
    message: 'Callback to AS',
    request,
  });

  callbackToClient(
    callbackUrl,
    {
      type: 'data_request',
      request_id: request.request_id,
      mode: request.mode,
      namespace: request.namespace,
      identifier: request.identifier,
      service_id: request.service_id,
      request_params: request.request_params,
      ...responseDetails,
    },
    true,
    common.shouldRetryCallback,
    [request.request_id],
    afterGotDataFromCallback,
    {
      rpId: request.rp_id,
      requestId: request.request_id,
      serviceId: request.service_id,
    }
  );
}

async function getResponseDetails(requestId) {
  const requestDetail = await tendermintNdid.getRequestDetail({
    requestId,
  });

  // TODO
  // Verify that (number of consent ≥ min_idp in request).
  // For each consent with matching request ID:
  // Verify the identity proof.
  // Verify the signature.
  // Verify that the message_hash is matching with the request.
  // Verify data_request_params with its hash

  // Get all signatures
  // and calculate max ial && max aal
  let response_signature_list = [];
  let max_ial = 0;
  let max_aal = 0;
  requestDetail.response_list.forEach((response) => {
    response_signature_list.push(response.signature);
    if (response.aal > max_aal) max_aal = response.aal;
    if (response.ial > max_ial) max_ial = response.ial;
  });

  return {
    response_signature_list,
    max_aal,
    max_ial,
  };
}

export async function handleMessageFromQueue(messageStr) {
  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    messageStr,
  });
  let requestId;
  try {
    const message = JSON.parse(messageStr);
    requestId = message.request_id;

    const latestBlockHeight = tendermint.latestBlockHeight;
    if (latestBlockHeight <= message.height) {
      logger.debug({
        message: 'Saving message from MQ',
        tendermintLatestBlockHeight: latestBlockHeight,
        messageBlockHeight: message.height,
      });
      await db.setRequestReceivedFromMQ(message.request_id, message);
      await db.addRequestIdExpectedInBlock(message.height, message.request_id);
      return;
    }

    logger.debug({
      message: 'Processing request',
      requestId: message.request_id,
    });
    const valid = await common.checkRequestIntegrity(
      message.request_id,
      message
    );
    if (valid) {
      const responseDetails = await getResponseDetails(message.request_id);
      //loop and check zk proof for all response
      if (!(await verifyZKProof(message.request_id, message))) {
        //TODO, do not answer? or send data to rp and tell them proof is invalid?
        return;
      }
      getDataAndSendBackToRP(message, responseDetails);
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling message from message queue',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      callbackUrl: callbackUrls.error_url,
      action: 'handleMessageFromQueue',
      error: err,
      requestId,
    });
  }
}

export async function handleTendermintNewBlockHeaderEvent(
  error,
  result,
  missingBlockCount
) {
  try {
    const height = tendermint.getBlockHeightFromNewBlockHeaderEvent(result);
    //console.log('received',height);
    // messages that arrived before 'NewBlock' event
    // including messages between the start of missing block's height
    // and the block before latest block height
    // (not only just (current height - 1) in case 'NewBlock' events are missing)
    // NOTE: tendermint always create a pair of block. A block with transactions and
    // a block that signs the previous block which indicates that the previous block is valid
    const fromHeight =
      missingBlockCount == null
        ? 1
        : missingBlockCount === 0
          ? height - 1
          : height - missingBlockCount;
    const toHeight = height - 1;

    const requestIdsInTendermintBlock = await db.getRequestIdsExpectedInBlock(
      fromHeight,
      toHeight
    );

    logger.debug({
      message: 'Getting request IDs to process',
      fromHeight,
      toHeight,
      requestIdsInTendermintBlock,
    });

    await Promise.all(
      requestIdsInTendermintBlock.map(async (requestId) => {
        logger.debug({
          message: 'Processing request',
          requestId,
        });
        const request = await db.getRequestReceivedFromMQ(requestId);
        const valid = await common.checkRequestIntegrity(requestId, request);
        if (valid && (await verifyZKProof(requestId))) {
          const responseDetails = await getResponseDetails(requestId);
          getDataAndSendBackToRP(request, responseDetails);
        }
        db.removeRequestReceivedFromMQ(requestId);
      })
    );

    db.removeRequestIdsExpectedInBlock(fromHeight, toHeight);
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling Tendermint NewBlock event',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      callbackUrl: callbackUrls.error_url,
      action: 'handleTendermintNewBlockHeaderEvent',
      error: err,
    });
  }
}

export async function registerOrUpdateASService(
  { service_id, reference_id, callback_url, min_ial, min_aal, url },
  { synchronous = false } = {}
) {
  try {
    //check already register?
    let registeredASList = await tendermintNdid.getAsNodesByServiceId({
      service_id,
    });
    let isRegisterd = false;
    registeredASList.forEach(({ node_id }) => {
      isRegisterd = isRegisterd || node_id === config.nodeId;
    });

    if (!isRegisterd) {
      if (!service_id || !min_aal || !min_ial || !url) {
        throw new CustomError({
          message: errorType.MISSING_ARGUMENTS.message,
          code: errorType.MISSING_ARGUMENTS.code,
          clientError: true,
        });
      }
    }

    if (synchronous) {
      await registerOrUpdateASServiceInternalAsync(...arguments, {
        isRegisterd,
      });
    } else {
      registerOrUpdateASServiceInternalAsync(...arguments, {
        isRegisterd,
      });
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register/update AS service',
      service_id,
      reference_id,
      callback_url,
      min_ial,
      min_aal,
      url,
      synchronous,
      cause: error,
    });
  }
}

async function registerOrUpdateASServiceInternalAsync(
  { service_id, reference_id, callback_url, min_ial, min_aal, url },
  { synchronous = false } = {},
  { isRegisterd }
) {
  try {
    const promises = [];
    if (!isRegisterd) {
      promises.push(
        tendermintNdid.registerServiceDestination({
          service_id,
          min_aal,
          min_ial,
          node_id: config.nodeId,
        })
      );
    } else {
      promises.push(
        tendermintNdid.updateServiceDestination({
          service_id,
          min_aal,
          min_ial,
        })
      );
    }
    if (url) {
      promises.push(db.setServiceCallbackUrl(service_id, url));
    }

    await Promise.all(promises);

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'add_or_update_service_result',
          success: true,
          reference_id,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: 'Upsert AS service internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'add_or_update_service_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}

export async function getServiceDetail(service_id) {
  try {
    const services = await tendermintNdid.getServicesByAsID({
      as_id: config.nodeId,
    });
    const service = services.find((service) => {
      return service.service_id === service_id;
    });
    if (service == null) return null;
    return {
      url: await db.getServiceCallbackUrl(service_id),
      min_ial: service.min_ial,
      min_aal: service.min_aal,
      active: service.active,
      suspended: service.suspended,
    };
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get service details',
      cause: error,
    });
  }
}

async function verifyZKProof(request_id, dataFromMq) {
  if (!dataFromMq) dataFromMq = await db.getRequestReceivedFromMQ(request_id);

  let {
    privateProofObjectList,
    namespace,
    identifier,
    request_message,
  } = dataFromMq;

  let requestDetail = await tendermintNdid.getRequestDetail({
    requestId: request_id,
  });
  //mode 1 bypass zkp
  //but still need to check signature of node
  if (requestDetail.mode === 1) {
    /*let response_list = requestDetail.response_list;
    for(let i = 0 ; i < response_list.length ; i++) {
      let { signature, idp_id } = response_list[i];
      let { public_key } = await common.getNodePubKey(idp_id);
      if(!utils.verifySignature(signature, public_key, JSON.stringify(request_message))) return false; 
    }*/
    return true;
  }

  //query and verify zk, also check conflict with each others
  let accessor_group_id = await tendermintNdid.getAccessorGroupId(
    privateProofObjectList[0].privateProofObject.accessor_id
  );
  for (let i = 1; i < privateProofObjectList.length; i++) {
    let otherGroupId = await tendermintNdid.getAccessorGroupId(
      privateProofObjectList[i].privateProofObject.accessor_id
    );
    if (otherGroupId !== accessor_group_id) {
      //TODO handle this?
      //throw 'Conflicted response';
      return false;
    }
  }

  let response_list = (await tendermintNdid.getRequestDetail({
    requestId: request_id,
  })).response_list;
  let valid = true;
  for (let i = 0; i < privateProofObjectList.length; i++) {
    //query accessor_public_key from privateProof.accessor_id
    let public_key = await tendermintNdid.getAccessorKey(
      privateProofObjectList[i].privateProofObject.accessor_id
    );
    //query publicProof from response of idp_id in request
    let publicProof, signature, privateProofValueHash;
    response_list.forEach((response) => {
      if (response.idp_id === privateProofObjectList[i].idp_id) {
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
      privateProofObjectList,
    });

    let zkProofValid = utils.verifyZKProof(
      public_key,
      dataFromMq.challenge,
      privateProofObjectList[i].privateProofObject.privateProofValue,
      publicProof,
      {
        namespace,
        identifier,
      },
      privateProofValueHash,
      privateProofObjectList[i].privateProofObject.padding
    );
    valid = valid && signatureValid && zkProofValid;
  }
  return valid;
}
