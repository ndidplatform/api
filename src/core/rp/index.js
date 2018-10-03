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

import * as tendermintNdid from '../../tendermint/ndid';
import * as mq from '../../mq';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../private_message_type';
import CustomError from '../../error/custom_error';
import errorType from '../../error/type';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

export * from './event_handlers';

export const callbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  config.dataDirectoryPath,
  'rp-callback-url-' + config.nodeId
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

export function isAllIdpResponsesValid(responseValidList) {
  for (let i = 0; i < responseValidList.length; i++) {
    const { valid_proof, valid_ial } = responseValidList[i];
    if (valid_proof !== true || valid_ial !== true) {
      return false;
    }
  }
  return true;
}

export function isAllIdpRespondedAndValid({
  requestStatus,
  responseValidList,
}) {
  if (requestStatus.status !== 'confirmed') return false;
  if (requestStatus.answered_idp_count !== requestStatus.min_idp) return false;
  if (requestStatus.closed === true || requestStatus.timed_out === true)
    return false;
  const asAnswerCount = requestStatus.service_list.reduce(
    (total, service) => total + service.signed_data_count,
    0
  );
  if (asAnswerCount === 0) {
    // Send request to AS only when all IdP responses' proof and IAL are valid in mode 3
    if (
      requestStatus.mode === 1 ||
      (requestStatus.mode === 3 && isAllIdpResponsesValid(responseValidList))
    ) {
      return true;
    }
  }
  return false;
}

async function getASReceiverList(data_request) {
  const asNodes = await tendermintNdid.getAsNodesInfoByServiceId({
    service_id: data_request.service_id,
    node_id_list: data_request.as_id_list, // filter to include only nodes in this list if node ID exists
  });

  const receivers = asNodes
    .map((asNode) => {
      if (asNode.proxy != null) {
        if (asNode.proxy.mq == null) {
          return null;
        }
        return {
          node_id: asNode.node_id,
          public_key: asNode.public_key,
          proxy: {
            node_id: asNode.proxy.node_id,
            public_key: asNode.proxy.public_key,
            ip: asNode.proxy.mq[0].ip,
            port: asNode.proxy.mq[0].port,
            config: asNode.proxy.config,
          },
        };
      } else {
        if (asNode.mq == null) {
          return null;
        }
        return {
          node_id: asNode.node_id,
          public_key: asNode.public_key,
          ip: asNode.mq[0].ip,
          port: asNode.mq[0].port,
        };
      }
    })
    .filter((asNode) => asNode != null);
  return receivers;
}

export async function sendRequestToAS(nodeId, requestData, height) {
  logger.debug({
    message: 'Sending request to AS',
    nodeId,
    requestData,
    height,
  });

  if (requestData.data_request_list == null) return;
  if (requestData.data_request_list.length === 0) return;

  const [privateProofObjectList, requestCreationMetadata] = await Promise.all([
    cacheDb.getPrivateProofObjectListInRequest(nodeId, requestData.request_id),
    cacheDb.getRequestCreationMetadata(nodeId, requestData.request_id),
  ]);

  const dataToSendByNodeId = {};
  await Promise.all(
    requestData.data_request_list.map(async (data_request, index) => {
      const receivers = await getASReceiverList(data_request);
      if (receivers.length === 0) {
        logger.error({
          message: 'No AS found',
          data_request,
        });
        return;
      }

      const serviceDataRequest = {
        service_id: data_request.service_id,
        request_params: data_request.request_params,
        request_params_salt: requestData.data_request_params_salt_list[index],
      };
      receivers.forEach((receiver) => {
        if (dataToSendByNodeId[receiver.node_id]) {
          dataToSendByNodeId[receiver.node_id].service_data_request_list.push(
            serviceDataRequest
          );
          dataToSendByNodeId[receiver.node_id].concat_service_id_index +=
            '|' + index.toString();
        } else {
          dataToSendByNodeId[receiver.node_id] = {
            receiver,
            service_data_request_list: [serviceDataRequest],
            concat_service_id_index: index.toString(),
          };
        }
      });
    })
  );

  const dataToSendByNodeIdAndServiceList = {};
  Object.values(dataToSendByNodeId).forEach(
    ({ receiver, service_data_request_list, concat_service_id_index }) => {
      if (dataToSendByNodeIdAndServiceList[concat_service_id_index]) {
        dataToSendByNodeIdAndServiceList[
          concat_service_id_index
        ].receivers.push(receiver);
      } else {
        dataToSendByNodeIdAndServiceList[concat_service_id_index] = {
          receivers: [receiver],
          service_data_request_list,
        };
      }
    }
  );

  await Promise.all(
    Object.values(dataToSendByNodeIdAndServiceList).map(
      ({ receivers, service_data_request_list }) =>
        mq.send(
          receivers,
          {
            type: privateMessageType.DATA_REQUEST,
            request_id: requestData.request_id,
            mode: requestData.mode,
            namespace: requestData.namespace,
            identifier: requestData.identifier,
            service_data_request_list,
            request_message: requestData.request_message,
            request_message_salt: requestData.request_message_salt,
            creation_time: requestCreationMetadata.creation_time,
            challenge: requestData.challenge,
            privateProofObjectList,
            rp_id: requestData.rp_id,
            height,
            initial_salt: requestData.initial_salt,
          },
          nodeId
        )
    )
  );
}

export async function getRequestIdByReferenceId(nodeId, referenceId) {
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

    return await cacheDb.getRequestIdByReferenceId(nodeId, referenceId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get request ID by reference ID',
      cause: error,
    });
  }
}

export async function getDataFromAS(nodeId, requestId) {
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

    // Check if request exists
    const request = await tendermintNdid.getRequest({ requestId });
    if (request == null) {
      return null;
    }

    return await cacheDb.getDatafromAS(nodeId, requestId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get data received from AS',
      cause: error,
    });
  }
}

export async function removeDataFromAS(nodeId, requestId) {
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

    return await cacheDb.removeDataFromAS(nodeId, requestId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot remove data received from AS',
      cause: error,
    });
  }
}

export async function removeAllDataFromAS(nodeId) {
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

    return await cacheDb.removeAllDataFromAS(nodeId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot remove all data received from AS',
      cause: error,
    });
  }
}
