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

//==================== plain copy ===================================

import { getFunction } from '../../functions';
import { closeRequest } from '../common';

import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';

export async function revokeAccessorAfterCloseConsentRequest(
  { error },
  { nodeId, request_id },
  { callbackFnName, callbackAdditionalArgs }
) {
  try {
    if (error) throw error;
    logger.debug({
      message: 'Got consent, revoking accessor',
      nodeId,
      request_id,
    });

    const { type, accessor_id } = await cacheDb.getIdentityFromRequestId(
      nodeId,
      request_id
    );

    await tendermintNdid.revokeAccessor(
      {
        request_id,
        accessor_id,
      },
      nodeId,
      'identity.revokeAccessorAfterConsentAndBlockchain',
      [
        {
          nodeId,
          request_id,
          type,
        },
        { callbackFnName, callbackAdditionalArgs },
      ],
      true
    );
  } catch (error) {
    logger.error({
      message: 'Revoke accessor after close consent request error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      err: error,
    });

    if (callbackFnName != null) {
      if (callbackAdditionalArgs != null) {
        getFunction(callbackFnName)({ error }, ...callbackAdditionalArgs);
      } else {
        getFunction(callbackFnName)({ error });
      }
    }
  }
}

export async function revokeAccessorAfterConsentAndBlockchain(
  { error, chainDisabledRetryLater },
  { nodeId, request_id, type },
  { callbackFnName, callbackAdditionalArgs } = {}
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    await cacheDb.removeIdentityFromRequestId(nodeId, request_id);
    if (callbackAdditionalArgs != null) {
      getFunction(callbackFnName)({ type }, ...callbackAdditionalArgs);
    } else {
      getFunction(callbackFnName)({ type });
    }
  } catch (error) {
    logger.error({
      message: 'Revoke accessor after consent and blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      err: error,
    });

    if (callbackFnName != null) {
      if (callbackAdditionalArgs != null) {
        getFunction(callbackFnName)({ error }, ...callbackAdditionalArgs);
      } else {
        getFunction(callbackFnName)({ error });
      }
    }
  }
}
