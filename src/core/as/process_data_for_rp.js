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
import * as db from '../../db';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';

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
        { synchronous }
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
  { synchronous = false } = {}
) {
  try {
    if (error) throw error;

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
