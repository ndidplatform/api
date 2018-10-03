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

import { processDataForRP } from './process_data_for_rp';

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as cacheDb from '../../db/cache';

import errorType from '../../error/type';
import CustomError from '../../error/custom_error';
import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

export * from './register_or_update_as_service';
export * from './process_data_for_rp';
export * from './event_handlers';

export const callbackUrls = {};
export const seviceCallbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  config.dataDirectoryPath,
  'as-callback-url-'
);

[{ key: 'error_url', fileSuffix: 'error' }].forEach(({ key, fileSuffix }) => {
  try {
    callbackUrls[key] = fs.readFileSync(
      callbackUrlFilesPrefix + config.nodeId + '-' + fileSuffix,
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
  fs.writeFile(
    callbackUrlFilesPrefix + config.nodeId + '-' + fileSuffix,
    url,
    (err) => {
      if (err) {
        logger.error({
          message: `Cannot write ${fileSuffix} callback url file`,
          error: err,
        });
      }
    }
  );
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

export function setServiceCallbackUrl(nodeId, serviceId, url) {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      callbackUrlFilesPrefix + nodeId + '-service-' + serviceId,
      url,
      (err) => {
        if (err) {
          reject(
            new CustomError({
              errorType: errorType.CANNOT_WRITE_CALLBACK_URL_TO_FILE,
              cause: err,
              details: {
                serviceId,
              },
            })
          );
          return;
        }
        seviceCallbackUrls[`${nodeId}:${serviceId}`] = url;
        resolve();
      }
    );
  });
}

export function getServiceCallbackUrl(nodeId, serviceId) {
  if (seviceCallbackUrls[`${nodeId}:${serviceId}`] != null) {
    return seviceCallbackUrls[`${nodeId}:${serviceId}`];
  }
  return new Promise((resolve, reject) => {
    fs.readFile(
      callbackUrlFilesPrefix + nodeId + '-service-' + serviceId,
      'utf8',
      (err, data) => {
        if (err) {
          reject(
            new CustomError({
              errorType: errorType.CANNOT_READ_CALLBACK_URL_FROM_FILE,
              cause: err,
              details: {
                nodeId,
                serviceId,
              },
            })
          );
          return;
        }
        seviceCallbackUrls[`${nodeId}:${serviceId}`] = data;
        resolve(data);
      }
    );
  });
}

async function checkReceiverIntegrity(requestId, requestDetail, nodeId) {
  for (let i = 0; i < requestDetail.service_data_request_list.length; i++) {
    const { as_id_list, service_id } = requestDetail.service_data_request_list[
      i
    ];

    const filterAsList = as_id_list.filter((node_id) => {
      return node_id === nodeId;
    });
    if (filterAsList.length === 0) {
      logger.warn({
        message: 'Request does not involve a service on receiver node',
        requestId,
        service_id,
      });
      logger.debug({
        message: 'Request does not involve a service on receiver node',
        requestId,
        service_id,
        as_id_list: requestDetail.request_message,
        receiverNodeId: nodeId,
      });
      return false;
    }
  }
  return true;
}

export async function processRequest(nodeId, request) {
  logger.debug({
    message: 'Processing request',
    nodeId,
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
  const receiverValid = checkReceiverIntegrity(
    request.request_id,
    requestDetail,
    nodeId
  );
  if (
    !requestMessageValid ||
    !serviceDataRequestParamsValid ||
    !receiverValid
  ) {
    throw new CustomError({
      errorType: errorType.REQUEST_INTEGRITY_CHECK_FAILED,
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
      errorType: errorType.INVALID_RESPONSES,
      details: {
        requestId: request.request_id,
      },
    });
  }
  const responseDetails = await getResponseDetails(request.request_id);
  await getDataAndSendBackToRP(nodeId, request, requestDetail, responseDetails);
}

export async function afterGotDataFromCallback(
  { error, response, body },
  additionalData
) {
  const { nodeId } = additionalData;
  try {
    if (error) throw error;
    if (response.status === 204) {
      return;
    }
    if (response.status !== 200) {
      const dataRequestId =
        additionalData.requestId + ':' + additionalData.serviceId;
      cacheDb.removeRpIdFromDataRequestId(nodeId, dataRequestId);
      throw new CustomError({
        errorType: errorType.INVALID_HTTP_RESPONSE_STATUS_CODE,
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
        errorType: errorType.CANNOT_PARSE_JSON,
        cause: error,
      });
    }
    if (result.data == null) {
      throw new CustomError({
        errorType: errorType.MISSING_DATA_IN_AS_DATA_RESPONSE,
        details: {
          result,
        },
      });
    }
    if (typeof result.data !== 'string') {
      throw new CustomError({
        errorType: errorType.INVALID_DATA_TYPE_IN_AS_DATA_RESPONSE,
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
      nodeId,
      callbackUrl: callbackUrls.error_url,
      action: 'afterGotDataFromCallback',
      error: err,
      requestId: additionalData.requestId,
    });
  }
}

async function getDataAndSendBackToRP(
  nodeId,
  request,
  requestDetail,
  responseDetails
) {
  // Platform→AS
  // The AS replies with the requested data
  logger.debug({
    message: 'AS process request for data',
    request,
    requestDetail,
    responseDetails,
  });

  await Promise.all(
    request.service_data_request_list.map(async (serviceData) => {
      let { service_id, request_params } = serviceData;
      const callbackUrl = await getServiceCallbackUrl(nodeId, service_id);

      if (!callbackUrl) {
        logger.error({
          message: 'Callback URL for AS has not been set',
          service_id,
        });
        return;
      }

      const dataRequestId = request.request_id + ':' + service_id;
      await cacheDb.setRpIdFromDataRequestId(
        nodeId,
        dataRequestId,
        request.rp_id
      );

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
          node_id: nodeId,
          type: 'data_request',
          request_id: request.request_id,
          mode: request.mode,
          namespace: request.namespace,
          identifier: request.identifier,
          service_id,
          request_params,
          requester_node_id: request.rp_id,
          response_signature_list: responseDetails.response_signature_list,
          max_aal: responseDetails.max_aal,
          max_ial: responseDetails.max_ial,
          creation_time: request.creation_time,
          creation_block_height: requestDetail.creation_block_height,
        },
        true,
        'common.isRequestClosedOrTimedOut',
        [request.request_id],
        'as.afterGotDataFromCallback',
        {
          nodeId,
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

export async function getServiceDetail(nodeId, service_id) {
  try {
    if (role === 'proxy') {
      if (nodeId == null) {
        throw new CustomError({
          errorType: errorType.MISSING_NODE_ID,
        });
      }
    } else {
      nodeId = config.nodeId;
    }

    const services = await tendermintNdid.getServicesByAsID({
      as_id: nodeId,
    });
    const service = services.find((service) => {
      return service.service_id === service_id;
    });
    if (service == null) return null;
    return {
      url: await getServiceCallbackUrl(nodeId, service_id),
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
  const {
    privateProofObjectList,
    namespace,
    identifier,
    request_message,
    initial_salt,
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

    const signatureValid = utils.verifyResponseSignature(
      signature,
      public_key,
      request_message,
      initial_salt,
      request_id
    );

    logger.debug({
      message: 'Verify signature',
      signatureValid,
      request_message,
      initial_salt,
      public_key,
      signature,
      privateProofObjectList,
    });

    const zkProofValid = utils.verifyZKProof(
      public_key,
      dataFromMq.challenge[privateProofObjectList[i].idp_id],
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
