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
import CustomError from '../error/custom_error';
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

const requestIdLocks = {};

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

export function setCallbackUrls({ error_url }) {
  if (error_url != null) {
    callbackUrls.error_url = error_url;
    writeCallbackUrlToFile('error', error_url);
  }
}

export function getCallbackUrls() {
  return callbackUrls;
}

export function getErrorCallbackUrl() {
  return callbackUrls.error_url;
}

export function getShouldRetryFn(fnName) {
  switch (fnName) {
    case 'common.isRequestClosedOrTimedOut':
      return common.isRequestClosedOrTimedOut;
    default:
      return function noop() {};
  }
}

export function getResponseCallbackFn(fnName) {
  switch (fnName) {
    case 'afterGotDataFromCallback':
      return afterGotDataFromCallback;
    default:
      return function noop() {};
  }
}

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
    ...(await tendermintNdid.getNodePubKey(nodeId)),
  });
  mq.send(receivers, {
    type: 'as_data_response',
    request_id: data.request_id,
    as_id: data.as_id,
    service_id: data.service_id,
    signature: data.signature,
    data_salt: data.data_salt,
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
    const data_salt = utils.randomBase64Bytes(16);
    const signature = await utils.createSignature(data + data_salt);

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
      data_salt,
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
  try {
    if (response.status === 204) {
      await db.setRPIdFromRequestId(
        additionalData.requestId,
        additionalData.rpId
      );
      return;
    }
    if (response.status !== 200) {
      throw new CustomError({
        message: errorType.INVALID_HTTP_RESPONSE_STATUS_CODE.message,
        code: errorType.INVALID_HTTP_RESPONSE_STATUS_CODE.code,
        details: {
          status: response.status,
          body,
        },
      });
    }
    let result;
    try {
      result = JSON.parse(body);

      logger.info({
        message: 'Received data from AS',
      });
      logger.debug({
        message: 'Data from AS',
        result,
      });
    } catch (error) {
      throw new CustomError({
        message: errorType.CANNOT_PARSE_JSON.message,
        code: errorType.CANNOT_PARSE_JSON.code,
        cause: error,
      });
    }
    if (result.data == null) {
      throw new CustomError({
        message: errorType.MISSING_DATA_IN_AS_DATA_RESPONSE.message,
        code: errorType.MISSING_DATA_IN_AS_DATA_RESPONSE.code,
        details: {
          result,
        },
      });
    }
    if (typeof result.data !== 'string') {
      throw new CustomError({
        message: errorType.INVALID_DATA_TYPE_IN_AS_DATA_RESPONSE.message,
        code: errorType.INVALID_DATA_TYPE_IN_AS_DATA_RESPONSE.code,
        details: {
          dataType: typeof result.data,
        },
      });
    }
    additionalData.reference_id = result.reference_id;
    additionalData.callback_url = result.callback_url;
    const synchronous =
      !additionalData.reference_id || !additionalData.callback_url;
    await processDataForRP(result.data, additionalData, { synchronous });
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing data response from AS',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      callbackUrl: callbackUrls.error_url,
      action: 'afterGotDataFromCallback',
      error: err,
      requestId: additionalData.requestId,
    });
  }
}

async function getDataAndSendBackToRP(request, responseDetails) {
  // Platform→AS
  // The AS replies with the requested data
  logger.debug({
    message: 'AS process request for data',
    request,
    responseDetails,
  });

  await Promise.all(
    request.service_data_request_list.map(async (serviceData) => {
      let { service_id, request_params } = serviceData;
      const callbackUrl = await db.getServiceCallbackUrl(service_id);

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
        service_id,
        request_params,
      });

      await callbackToClient(
        callbackUrl,
        {
          type: 'data_request',
          request_id: request.request_id,
          mode: request.mode,
          namespace: request.namespace,
          identifier: request.identifier,
          service_id,
          request_params,
          ...responseDetails,
        },
        true,
        'common.isRequestClosedOrTimedOut',
        [request.request_id],
        'afterGotDataFromCallback',
        {
          rpId: request.rp_id,
          requestId: request.request_id,
          serviceId: service_id,
        }
      );
    })
  );
}

async function getResponseDetails(requestId) {
  const requestDetail = await tendermintNdid.getRequestDetail({
    requestId,
  });

  // Get all signatures
  // Calculate max IAL and max AAL
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

export async function checkServiceRequestParamsIntegrity(
  requestId,
  request,
  requestDetail
) {
  if (!requestDetail) {
    requestDetail = await tendermintNdid.getRequestDetail({ requestId });
  }

  for (let i = 0; i < request.service_data_request_list.length; i++) {
    const {
      service_id,
      request_params,
      request_params_salt,
    } = request.service_data_request_list[i];

    const dataRequest = requestDetail.data_request_list.find(
      (dataRequest) => dataRequest.service_id === service_id
    );

    const requestParamsHash = utils.hash(request_params + request_params_salt);
    const dataRequestParamsValid =
      dataRequest.request_params_hash === requestParamsHash;
    if (!dataRequestParamsValid) {
      logger.warn({
        message: 'Request data request params hash mismatched',
        requestId,
      });
      logger.debug({
        message: 'Request data request params hash mismatched',
        requestId,
        givenRequestParams: request_params,
        givenRequestParamsHashWithSalt: requestParamsHash,
        requestParamsHashFromBlockchain: dataRequest.request_params_hash,
      });
      return false;
    }
  }
  return true;
}

async function processRequest(request) {
  logger.debug({
    message: 'Processing request',
    requestId: request.request_id,
  });
  const requestDetail = await tendermintNdid.getRequestDetail({
    requestId: request.request_id,
  });
  const requestMessageValid = await common.checkRequestMessageIntegrity(
    request.request_id,
    request,
    requestDetail
  );
  const serviceDataRequestParamsValid = await checkServiceRequestParamsIntegrity(
    request.request_id,
    request,
    requestDetail
  );
  if (!requestMessageValid || !serviceDataRequestParamsValid) {
    throw new CustomError({
      message: errorType.REQUEST_INTEGRITY_CHECK_FAILED.message,
      code: errorType.REQUEST_INTEGRITY_CHECK_FAILED.code,
      details: {
        requestId: request.request_id,
      },
    });
  }
  const idpResponsesValid = await isIdpResponsesValid(
    request.request_id,
    request
  );
  if (!idpResponsesValid) {
    throw new CustomError({
      message: errorType.INVALID_RESPONSES.message,
      code: errorType.INVALID_RESPONSES.code,
      details: {
        requestId: request.request_id,
      },
    });
  }
  const responseDetails = await getResponseDetails(request.request_id);
  await getDataAndSendBackToRP(request, responseDetails);
}

export async function handleMessageFromQueue(messageStr) {
  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    messageStr,
  });
  // TODO: validate message schema

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
      requestIdLocks[message.request_id] = true;
      await Promise.all([
        db.setRequestReceivedFromMQ(message.request_id, message),
        db.addRequestIdExpectedInBlock(message.height, message.request_id),
      ]);
      if (tendermint.latestBlockHeight <= message.height) {
        delete requestIdLocks[message.request_id];
        return;
      } else {
        await db.removeRequestReceivedFromMQ(requestId);
      }
    }

    await processRequest(message);
    delete requestIdLocks[message.request_id];
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

export async function handleTendermintNewBlockEvent(
  error,
  result,
  missingBlockCount
) {
  if (missingBlockCount == null) return;
  try {
    const height = tendermint.getBlockHeightFromNewBlockEvent(result);

    // messages that arrived before 'NewBlock' event
    // including messages between the start of missing block's height
    // and the block before latest block height
    // (not only just (current height - 1) in case 'NewBlock' events are missing)
    // NOTE: tendermint always create a pair of block. A block with transactions and
    // a block that signs the previous block which indicates that the previous block is valid
    const fromHeight = height - 1 - missingBlockCount;
    const toHeight = height - 1;

    logger.debug({
      message: 'Getting request IDs to process',
      fromHeight,
      toHeight,
    });

    const requestIdsInTendermintBlock = await db.getRequestIdsExpectedInBlock(
      fromHeight,
      toHeight
    );
    await Promise.all(
      requestIdsInTendermintBlock.map(async (requestId) => {
        if (requestIdLocks[requestId]) return;
        const request = await db.getRequestReceivedFromMQ(requestId);
        if (request == null) return;
        await processRequest(request);
        await db.removeRequestReceivedFromMQ(requestId);
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
      action: 'handleTendermintNewBlockEvent',
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

async function isIdpResponsesValid(request_id, dataFromMq) {
  if (!dataFromMq) {
    dataFromMq = await db.getRequestReceivedFromMQ(request_id);
  }

  const {
    privateProofObjectList,
    namespace,
    identifier,
    request_message,
    request_message_salt,
  } = dataFromMq;

  const requestDetail = await tendermintNdid.getRequestDetail({
    requestId: request_id,
  });

  if (requestDetail.min_idp !== requestDetail.response_list.length) {
    return false;
  }

  // mode 1 bypass zkp
  if (requestDetail.mode === 1) {
    return true;
  }

  //query and verify zk, also check conflict with each others
  const accessor_group_id = await tendermintNdid.getAccessorGroupId(
    privateProofObjectList[0].privateProofObject.accessor_id
  );
  for (let i = 1; i < privateProofObjectList.length; i++) {
    let otherGroupId = await tendermintNdid.getAccessorGroupId(
      privateProofObjectList[i].privateProofObject.accessor_id
    );
    if (otherGroupId !== accessor_group_id) {
      return false;
    }
  }

  const response_list = (await tendermintNdid.getRequestDetail({
    requestId: request_id,
  })).response_list;
  let valid = true;
  for (let i = 0; i < privateProofObjectList.length; i++) {
    //query accessor_public_key from privateProof.accessor_id
    const public_key = await tendermintNdid.getAccessorKey(
      privateProofObjectList[i].privateProofObject.accessor_id
    );
    //query publicProof from response of idp_id in request
    const response = response_list.find(
      (response) => response.idp_id === privateProofObjectList[i].idp_id
    );
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
      privateProofObjectList,
    });

    const zkProofValid = utils.verifyZKProof(
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
