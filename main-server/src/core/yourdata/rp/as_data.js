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
import logger from '../../../logger';

import * as config from '../../../config';
import { role } from '../../../node';

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

    return await cacheDb.getYourDataDataFromAS(nodeId, requestId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get YourData data received from AS',
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

    await Promise.all([
      cacheDb.removeYourDataDataFromAS(nodeId, requestId),
      cacheDb.removeYourDataEncryptedData(nodeId, requestId),
    ]);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot remove YourData data received from AS',
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

    await Promise.all([
      cacheDb.removeAllYourDataDataFromAS(nodeId),
      cacheDb.removeAllYourDataEncryptedData(nodeId),
    ]);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot remove all YourData data received from AS',
      cause: error,
    });
  }
}
