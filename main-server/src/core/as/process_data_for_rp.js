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

import parseDataURL from 'data-urls';

import validateData from './data_validator';
import * as tendermint from '../../tendermint';

import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../../logger';
import TelemetryLogger, { REQUEST_EVENTS } from '../../telemetry';

import * as tendermintNdid from '../../tendermint/ndid';
import * as nodeCallback from '../node_callback';
import * as mq from '../../mq';
import * as utils from '../../utils';
import * as config from '../../config';
import * as cacheDb from '../../db/cache';
import { getErrorObjectForClient } from '../../utils/error';
import privateMessageType from '../../mq/message/type';
import { dataUrlRegex } from '../../data_url';

import { role } from '../../node';

export async function processDataForRP(
  data,
  processDataForRPParams,
  {
    synchronous = false,
    apiVersion,
    throughCallbackResponse = false,
    ndidMemberAppType,
    ndidMemberAppVersion,
  } = {}
) {
  let { node_id } = processDataForRPParams;
  const {
    reference_id,
    callback_url,
    requestId,
    serviceId,
    rpId,
    error_code,
  } = processDataForRPParams;

  if (role === 'proxy') {
    if (node_id == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    node_id = config.nodeId;
  }

  try {
    const requestDetail = await tendermintNdid.getRequestDetail({
      requestId,
    });
    if (requestDetail == null) {
      throw new CustomError({
        errorType: errorType.REQUEST_NOT_FOUND,
        details: {
          requestId,
        },
      });
    }
    if (requestDetail.closed) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_CLOSED,
        details: {
          requestId,
        },
      });
    }
    if (requestDetail.timed_out) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_TIMED_OUT,
        details: {
          requestId,
        },
      });
    }

    // Check if there is an input service ID in the request
    const serviceInRequest = requestDetail.data_request_list.find(
      (dataRequest) => dataRequest.service_id === serviceId
    );
    if (serviceInRequest == null) {
      throw new CustomError({
        errorType: errorType.SERVICE_ID_NOT_FOUND_IN_REQUEST,
      });
    }

    // log request event: AS_RECEIVES_QUERIED_DATA
    TelemetryLogger.logRequestEvent(
      requestId,
      node_id,
      REQUEST_EVENTS.AS_RECEIVES_QUERIED_DATA,
      {
        service_id: serviceId,
        api_spec_version: apiVersion.toString(),
        through_callback_response: throughCallbackResponse,
        ndid_member_app_type: ndidMemberAppType,
        ndid_member_app_version: ndidMemberAppVersion,
      }
    );

    const dataRequestId = requestId + ':' + serviceId;
    const savedRpId = await cacheDb.getRpIdFromDataRequestId(
      node_id,
      dataRequestId
    );

    if (!savedRpId) {
      throw new CustomError({
        errorType: errorType.UNKNOWN_DATA_REQUEST,
      });
    }

    // check current responses with min_as
    const nonErrorResponseCount = serviceInRequest.response_list.filter(
      ({ error_code }) => error_code == null
    ).length;
    if (nonErrorResponseCount >= serviceInRequest.min_as) {
      throw new CustomError({
        errorType: errorType.ENOUGH_AS_RESPONSE,
      });
    }
    const remainingPossibleResponseCount =
      serviceInRequest.as_id_list.length -
      serviceInRequest.response_list.length;
    if (
      nonErrorResponseCount + remainingPossibleResponseCount <
      serviceInRequest.min_as
    ) {
      throw new CustomError({
        errorType: errorType.ENOUGH_AS_RESPONSE,
      });
    }

    if (error_code == null) {
      const dataValidationResult = await validateData({ serviceId, data });
      if (dataValidationResult.valid === false) {
        throw new CustomError({
          errorType: errorType.DATA_VALIDATION_FAILED,
          details: dataValidationResult,
        });
      }

      const dataUrlParsedData = parseDataURL(data);
      if (dataUrlParsedData != null) {
        const match = data.match(dataUrlRegex);
        if (match[4] && match[4].endsWith('base64') && data.search(/\s/) >= 0) {
          throw new CustomError({
            errorType: errorType.DATA_URL_BASE64_MUST_NOT_CONTAIN_WHITESPACES,
          });
        }
      }
    } else {
      const error_code_list = await tendermintNdid.getErrorCodeList('as');
      if (
        error_code_list.find((error) => error.error_code === error_code) == null
      ) {
        throw new CustomError({
          errorType: errorType.INVALID_ERROR_CODE,
          details: {
            as_error_code: error_code,
          },
        });
      }
    }

    if (synchronous) {
      await processDataForRPInternalAsync(...arguments, {
        nodeId: node_id,
        savedRpId,
      });
    } else {
      processDataForRPInternalAsync(...arguments, {
        nodeId: node_id,
        savedRpId,
      });
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot send data to RP',
      cause: error,
      details: {
        reference_id,
        callback_url,
        requestId,
        serviceId,
        rpId,
        synchronous,
      },
    });
    logger.error({ err });
    throw err;
  }
}

async function processDataForRPInternalAsync(
  data,
  { reference_id, callback_url, requestId, serviceId, rpId, error_code },
  { synchronous = false, apiVersion } = {},
  { nodeId, savedRpId }
) {
  try {
    let data_salt;
    let signature;
    if (error_code == null) {
      const initial_salt = await cacheDb.getInitialSalt(nodeId, requestId);
      data_salt = utils.generateDataSalt({
        request_id: requestId,
        service_id: serviceId,
        initial_salt,
      });
      const signatureBuffer = await utils.createSignature(
        data + data_salt,
        nodeId
      );
      signature = signatureBuffer.toString('base64');
    }

    let dataToBlockchain;
    if (error_code == null) {
      dataToBlockchain = {
        request_id: requestId,
        signature,
        service_id: serviceId,
      };
    } else {
      dataToBlockchain = {
        request_id: requestId,
        service_id: serviceId,
        error_code,
      };
    }

    if (!synchronous) {
      await tendermintNdid.createAsResponse(
        dataToBlockchain,
        nodeId,
        'as.processDataForRPInternalAsyncAfterBlockchain',
        [
          {
            reference_id,
            callback_url,
            data,
            requestId,
            serviceId,
            signature,
            data_salt,
            rpId,
            error_code,
          },
          { synchronous, apiVersion },
          { nodeId, savedRpId },
        ]
      );
    } else {
      const { height } = await tendermintNdid.createAsResponse(
        {
          request_id: requestId,
          signature,
          service_id: serviceId,
          error_code,
        },
        nodeId
      );
      await processDataForRPInternalAsyncAfterBlockchain(
        { height },
        {
          reference_id,
          callback_url,
          data,
          requestId,
          serviceId,
          signature,
          data_salt,
          rpId,
          error_code,
        },
        { synchronous, apiVersion },
        { nodeId, savedRpId }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Send data to RP internal async error',
      data,
      error_code,
      originalArgs: arguments[1],
      options: arguments[2],
      additionalArgs: arguments[3],
      err: error,
    });

    if (!synchronous) {
      const type =
        apiVersion === '4.0' ? 'send_data_result' : 'response_result';
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type,
          success: false,
          reference_id,
          request_id: requestId,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    }

    throw error;
  }
}

export async function processDataForRPInternalAsyncAfterBlockchain(
  { height, error, chainDisabledRetryLater },
  {
    reference_id,
    callback_url,
    data,
    requestId,
    serviceId,
    signature,
    data_salt,
    rpId,
    error_code,
  },
  { synchronous = false, apiVersion } = {},
  { nodeId, savedRpId }
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    // log request event: AS_LOGS_HASH_DATA
    TelemetryLogger.logRequestEvent(
      requestId,
      nodeId,
      REQUEST_EVENTS.AS_LOGS_HASH_DATA,
      {
        service_id: serviceId,
      }
    );

    if (!rpId) {
      rpId = savedRpId;
    }

    let dataToSendToRP;
    if (error_code == null) {
      dataToSendToRP = {
        request_id: requestId,
        as_id: nodeId,
        signature,
        data_salt,
        service_id: serviceId,
        data,
        height,
      };
    } else {
      dataToSendToRP = {
        request_id: requestId,
        as_id: nodeId,
        service_id: serviceId,
        error_code,
        height,
      };
    }

    await sendDataToRP(nodeId, rpId, dataToSendToRP);

    if (!synchronous) {
      const type =
        apiVersion === '4.0' ? 'send_data_result' : 'response_result';
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type,
          success: true,
          reference_id,
          request_id: requestId,
        },
        retry: true,
      });
    }

    const dataRequestId = requestId + ':' + serviceId;
    cacheDb.removeRpIdFromDataRequestId(nodeId, dataRequestId);
  } catch (error) {
    logger.error({
      message: 'Send data to RP internal async after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      err: error,
    });

    if (!synchronous) {
      const type =
        apiVersion === '4.0' ? 'send_data_result' : 'response_result';
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type,
          success: false,
          reference_id,
          request_id: requestId,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    } else {
      throw error;
    }
  }
}

async function sendDataToRP(nodeId, rpId, data) {
  const nodeInfo = await tendermintNdid.getNodeInfo(rpId);
  if (nodeInfo == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: {
        request_id: data.request_id,
      },
    });
  }

  let receivers;
  if (nodeInfo.proxy != null) {
    if (nodeInfo.proxy.mq == null || nodeInfo.proxy.mq.length === 0) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id: data.request_id,
          nodeId: rpId,
        },
      });
    }
    receivers = [
      {
        node_id: rpId,
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
    if (nodeInfo.mq == null || nodeInfo.mq.length === 0) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id: data.request_id,
          nodeId: rpId,
        },
      });
    }
    receivers = [
      {
        node_id: rpId,
        public_key: nodeInfo.public_key,
        ip: nodeInfo.mq[0].ip,
        port: nodeInfo.mq[0].port,
      },
    ];
  }
  await mq.send({
    receivers,
    message: {
      type: privateMessageType.AS_RESPONSE,
      request_id: data.request_id,
      as_id: data.as_id,
      service_id: data.service_id,
      signature: data.signature,
      data_salt: data.data_salt,
      data: data.data,
      error_code: data.error_code,
      chain_id: tendermint.chainId,
      height: data.height,
    },
    senderNodeId: nodeId,
    onSuccess: ({ mqDestAddress, receiverNodeId }) => {
      // log request event: AS_SENDS_DATA_TO_RP
      TelemetryLogger.logRequestEvent(
        data.request_id,
        nodeId,
        REQUEST_EVENTS.AS_SENDS_DATA_TO_RP,
        {
          service_id: data.service_id,
        }
      );

      nodeCallback.notifyMessageQueueSuccessSend({
        nodeId,
        getCallbackUrlFnName:
          'nodeCallback.getMessageQueueSendSuccessCallbackUrl',
        destNodeId: receiverNodeId,
        destIp: mqDestAddress.ip,
        destPort: mqDestAddress.port,
        requestId: data.request_id,
      });
    },
  });
}
