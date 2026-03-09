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

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import * as cacheDb from '../../../db/cache';

import * as config from '../../../config';
import { role } from '../../../node';

export * from './create_request';
export * from './as_data';
export * from './timeout_request';
export * from './data_decryption_key_retry_request';
export * from './message_handlers';

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

    return await cacheDb.getYourDataRequestIdByReferenceId(nodeId, referenceId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get Your Data request ID by reference ID',
      cause: error,
    });
  }
}

export async function cleanupRequestCachedData({
  nodeId,
  requestId,
  referenceId,
}) {
  await Promise.all([
    cacheDb.removeYourDataRequestData(nodeId, requestId),
    cacheDb.removeYourDataCurrentRequestStatus(nodeId, requestId),
    cacheDb.removeYourDataRequestIdByReferenceId(nodeId, referenceId),
  ]);
}

export async function getDataDecryptionKeyRetryRequestIdByReferenceId(nodeId, referenceId) {
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

    return await cacheDb.getYourDataRetryRequestIdByReferenceId(nodeId, referenceId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get Your Data data decryption key retry request ID by reference ID',
      cause: error,
    });
  }
}
