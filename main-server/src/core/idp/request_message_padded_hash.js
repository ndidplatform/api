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

import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import * as utils from '../../utils';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

/**
 * Generate request message padded hash for response signing
 *
 * @param {Object} getRequestMessagePaddedHashParams
 * @param {string} getRequestMessagePaddedHashParams.node_id
 * @param {string} getRequestMessagePaddedHashParams.request_id
 * @param {string} getRequestMessagePaddedHashParams.accessor_id
 */
export async function getRequestMessagePaddedHash(
  getRequestMessagePaddedHashParams
) {
  let { node_id } = getRequestMessagePaddedHashParams;

  const { request_id, accessor_id } = getRequestMessagePaddedHashParams;

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
    const request = await tendermintNdid.getRequestDetail({
      requestId: request_id,
    });
    if (request == null) {
      throw new CustomError({
        errorType: errorType.REQUEST_NOT_FOUND,
        details: {
          requestId: request_id,
        },
      });
    }
    if (request.closed) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_CLOSED,
        details: {
          requestId: request_id,
        },
      });
    }
    if (request.timed_out) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_TIMED_OUT,
        details: {
          requestId: request_id,
        },
      });
    }

    if (request.mode !== 2 && request.mode !== 3) {
      throw new CustomError({
        errorType: errorType.NOT_MODE_2_OR_3_REQUEST,
        details: {
          requestId: request_id,
        },
      });
    }

    const requestData = await cacheDb.getRequestReceivedFromMQ(
      node_id,
      request_id
    );
    if (!requestData) {
      throw new CustomError({
        errorType: errorType.UNKNOWN_CONSENT_REQUEST,
      });
    }

    if (accessor_id == null) {
      throw new CustomError({
        errorType: errorType.ACCESSOR_ID_NEEDED,
      });
    }

    const accessorPublicKey = await tendermintNdid.getAccessorKey(accessor_id);
    if (accessorPublicKey == null) {
      throw new CustomError({
        errorType: errorType.ACCESSOR_PUBLIC_KEY_NOT_FOUND_OR_NOT_ACTIVE,
        details: {
          accessor_id,
        },
      });
    }

    const requestMessagePaddedHash = utils.hashRequestMessageForConsent(
      requestData.request_message,
      requestData.initial_salt,
      request_id,
      accessorPublicKey
    );

    return requestMessagePaddedHash;
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot get request message padded hash',
      cause: error,
    });
    logger.error({ err });
    throw err;
  }
}
