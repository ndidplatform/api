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

import { getFunction, closeRequest } from '../common';

import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';

export async function closeConsentRequestThenRevokeAccessor(
  { nodeId, request_id, old_accessor_id, revoking_accessor_id },
  { callbackFnName, callbackAdditionalArgs }
) {
  await closeRequest(
    {
      node_id: nodeId,
      request_id: request_id,
    },
    {
      synchronous: false,
      sendCallbackToClient: false,
      callbackFnName: 'identity.revokeAccessorAfterCloseConsentRequest',
      callbackAdditionalArgs: [
        { nodeId, request_id, old_accessor_id, revoking_accessor_id },
        { callbackFnName, callbackAdditionalArgs },
      ],
    }
  );
}

export async function revokeAccessorAfterCloseConsentRequest(
  { error },
  { nodeId, request_id, old_accessor_id, revoking_accessor_id },
  { callbackFnName, callbackAdditionalArgs }
) {
  try {
    if (error) throw error;
    //NOTE: zero knowledge proof cannot be verify by blockchain, hence,
    //if this idp call to add their accessor it's imply that zk proof is verified by them
    logger.debug({
      message: 'Got consent, revoking accessor',
      nodeId,
      request_id,
      old_accessor_id,
    });

    await tendermintNdid.revokeAccessorMethod(
      {
        request_id,
        accessor_id: revoking_accessor_id,
      },
      nodeId,
      'identity.notifyRevokeAccessorAfterConsent',
      [
        {
          nodeId,
          request_id,
        },
        { callbackFnName, callbackAdditionalArgs },
      ]
    );
  } catch (error) {
    logger.error({
      message: 'Revoke accessor after close consent request error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      error,
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

export async function notifyRevokeAccessorAfterConsent(
  { error },
  { nodeId, request_id },
  { callbackFnName, callbackAdditionalArgs } = {}
) {
  try {
    if (error) throw error;

    await cacheDb.removeAccessorIdToRevokeFromRequestId(nodeId, request_id);
    if (callbackAdditionalArgs != null) {
      getFunction(callbackFnName)({}, ...callbackAdditionalArgs);
    } else {
      getFunction(callbackFnName)();
    }
  } catch (error) {
    logger.error({
      message: 'Revoke accessor after consent error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      error,
    });
    getFunction(callbackFnName)({ error });
  }
}
