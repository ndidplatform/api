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

import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';
import { callbackToClient } from '../../utils/callback';
import CustomError from '../../error/custom_error';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';

import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

/**
 * Close a request
 *
 * @param {Object} closeRequestParams
 * @param {string} closeRequestParams.node_id
 * @param {string} closeRequestParams.reference_id
 * @param {string} closeRequestParams.callback_url
 * @param {string} closeRequestParams.request_id
 * @param {Object} option
 * @param {boolean} options.synchronous
 */
export async function closeRequest(
  { node_id, reference_id, callback_url, request_id },
  { synchronous = false } = {}
) {
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
    if (synchronous) {
      await closeRequestInternalAsync(...arguments, { node_id });
    } else {
      closeRequestInternalAsync(...arguments, { node_id });
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
  { synchronous = false } = {},
  { node_id }
) {
  try {
    const responseValidList = await cacheDb.getIdpResponseValidList(
      node_id,
      request_id
    );

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
        node_id,
        'common.closeRequestInternalAsyncAfterBlockchain',
        [{ node_id, reference_id, callback_url, request_id }, { synchronous }]
      );
    } else {
      await tendermintNdid.closeRequest(
        {
          requestId: request_id,
          responseValidList,
        },
        node_id
      );
      await closeRequestInternalAsyncAfterBlockchain(
        {},
        { node_id, reference_id, callback_url, request_id },
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
          node_id,
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
  { node_id, reference_id, callback_url, request_id },
  { synchronous = false } = {}
) {
  try {
    if (error) throw error;

    removeTimeoutScheduler(node_id, request_id);

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          node_id,
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
          node_id,
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
