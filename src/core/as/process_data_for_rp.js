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

import { callbackToClient } from '../../utils/callback';
import CustomError from '../../error/custom_error';
import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as mq from '../../mq';
import * as utils from '../../utils';
import * as config from '../../config';
import * as cacheDb from '../../db/cache';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';
import privateMessageType from '../private_message_type';

export async function processDataForRP(
  data,
  { reference_id, callback_url, requestId, serviceId, rpId },
  { synchronous = false } = {}
) {
  try {
    const requestDetail = await tendermintNdid.getRequestDetail({
      requestId,
    });
    if (requestDetail == null) {
      throw new CustomError({
        message: errorType.REQUEST_NOT_FOUND.message,
        code: errorType.REQUEST_NOT_FOUND.code,
        clientError: true,
        details: {
          requestId,
        },
      });
    }
    if (requestDetail.closed) {
      throw new CustomError({
        message: errorType.REQUEST_IS_CLOSED.message,
        code: errorType.REQUEST_IS_CLOSED.code,
        clientError: true,
        details: {
          requestId,
        },
      });
    }
    if (requestDetail.timed_out) {
      throw new CustomError({
        message: errorType.REQUEST_IS_TIMED_OUT.message,
        code: errorType.REQUEST_IS_TIMED_OUT.code,
        clientError: true,
        details: {
          requestId,
        },
      });
    }

    // Check if there is an input service ID in the request
    const serviceIdInRequest = requestDetail.data_request_list.find(
      (dataRequest) => dataRequest.service_id === serviceId
    );
    if (serviceIdInRequest == null) {
      throw new CustomError({
        message: errorType.SERVICE_ID_NOT_FOUND_IN_REQUEST.message,
        code: errorType.SERVICE_ID_NOT_FOUND_IN_REQUEST.code,
        clientError: true,
      });
    }

    const dataRequestId = requestId + ':' + serviceId;
    const savedRpId = await cacheDb.getRpIdFromDataRequestId(dataRequestId);

    if (!savedRpId) {
      throw new CustomError({
        message: errorType.UNKNOWN_DATA_REQUEST.message,
        code: errorType.UNKNOWN_DATA_REQUEST.code,
        clientError: true,
      });
    }

    if (synchronous) {
      await processDataForRPInternalAsync(...arguments, { savedRpId });
    } else {
      processDataForRPInternalAsync(...arguments, { savedRpId });
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
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function processDataForRPInternalAsync(
  data,
  { reference_id, callback_url, requestId, serviceId, rpId },
  { synchronous = false } = {},
  { savedRpId }
) {
  try {
    const as_id = config.nodeId;
    const data_salt = utils.randomBase64Bytes(16);
    const signatureBuffer = await utils.createSignature(data + data_salt);
    const signature = signatureBuffer.toString('base64');

    if (!synchronous) {
      await tendermintNdid.signASData(
        {
          as_id,
          request_id: requestId,
          signature,
          service_id: serviceId,
        },
        'as.processDataForRPInternalAsyncAfterBlockchain',
        [
          {
            reference_id,
            callback_url,
            data,
            requestId,
            serviceId,
            as_id,
            signature,
            data_salt,
            rpId,
          },
          { synchronous },
          { savedRpId },
        ]
      );
    } else {
      const { height } = await tendermintNdid.signASData({
        as_id,
        request_id: requestId,
        signature,
        service_id: serviceId,
      });
      await processDataForRPInternalAsyncAfterBlockchain(
        { height },
        {
          reference_id,
          callback_url,
          data,
          requestId,
          serviceId,
          as_id,
          signature,
          data_salt,
          rpId,
        },
        { synchronous },
        { savedRpId }
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

export async function processDataForRPInternalAsyncAfterBlockchain(
  { height, error },
  {
    reference_id,
    callback_url,
    data,
    requestId,
    serviceId,
    as_id,
    signature,
    data_salt,
    rpId,
  },
  { synchronous = false } = {},
  { savedRpId }
) {
  try {
    if (error) throw error;

    if (!rpId) {
      rpId = savedRpId;
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

    const dataRequestId = requestId + ':' + serviceId;
    cacheDb.removeRpIdFromDataRequestId(dataRequestId);
  } catch (error) {
    logger.error({
      message: 'Send data to RP internal async after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
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
    } else {
      throw error;
    }
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
    type: privateMessageType.AS_DATA_RESPONSE,
    request_id: data.request_id,
    as_id: data.as_id,
    service_id: data.service_id,
    signature: data.signature,
    data_salt: data.data_salt,
    data: data.data,
    height: data.height,
  });
}
