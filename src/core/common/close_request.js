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

import { removeTimeoutScheduler } from '.';

import CustomError from '../../error/custom_error';
import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import { callbackToClient } from '../../utils/callback';
import { getErrorObjectForClient } from '../../error/helpers';
import * as db from '../../db';

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

    if (!synchronous) {
      await tendermintNdid.closeRequest(
        {
          requestId: request_id,
          responseValidList,
        },
        'common.closeRequestInternalAsyncAfterBlockchain',
        [{ reference_id, callback_url, request_id }, { synchronous }]
      );
    } else {
      await tendermintNdid.closeRequest({
        requestId: request_id,
        responseValidList,
      });
      await closeRequestInternalAsyncAfterBlockchain(
        {},
        { reference_id, callback_url, request_id },
        { synchronous }
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

export async function closeRequestInternalAsyncAfterBlockchain(
  { error },
  { reference_id, callback_url, request_id },
  { synchronous = false } = {}
) {
  try {
    if (error) throw error;

    db.removeChallengeFromRequestId(request_id);
    removeTimeoutScheduler(request_id);

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
      message: 'Close request internal async after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
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
    } else {
      throw error;
    }
  }
}
