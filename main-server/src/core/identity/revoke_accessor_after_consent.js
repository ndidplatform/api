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

import { getFunction } from '../../functions';

import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';

export async function revokeAccessorAfterCloseConsentRequest(
  { error },
  { nodeId, request_id, identity },
  { callbackFnName, callbackAdditionalArgs }
) {
  try {
    if (error) throw error;

    if (request_id) {
      logger.debug({
        message: 'Closed consent request',
        nodeId,
        request_id,
      });
    }

    logger.debug({
      message: 'Revoking accessor',
      nodeId,
    });

    if (identity == null) {
      identity = await cacheDb.getIdentityFromRequestId(nodeId, request_id);
    }
    const { type, accessor_id, reference_id } = identity;

    try {
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
            type,
            accessor_id,
            reference_id,
            request_id,
          },
          { callbackFnName, callbackAdditionalArgs },
        ],
        true
      );
    } catch (error) {
      logger.error({
        message: 'Revoke accessor error',
        tendermintResult: arguments[0],
        additionalArgs: arguments[1],
        options: arguments[2],
        err: error,
      });

      if (callbackFnName != null) {
        if (callbackAdditionalArgs != null) {
          getFunction(callbackFnName)(
            { error, type, accessor_id, reference_id, request_id },
            ...callbackAdditionalArgs
          );
        } else {
          getFunction(callbackFnName)({
            error,
            type,
            accessor_id,
            reference_id,
            request_id,
          });
        }
      }
    }
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
        getFunction(callbackFnName)(
          { error, request_id },
          ...callbackAdditionalArgs
        );
      } else {
        getFunction(callbackFnName)({ error, request_id });
      }
    }
  }
}

export async function revokeAccessorAfterConsentAndBlockchain(
  { error, chainDisabledRetryLater },
  { nodeId, type, accessor_id, reference_id, request_id },
  { callbackFnName, callbackAdditionalArgs } = {}
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    await cacheDb.removeIdentityFromRequestId(nodeId, request_id);
    if (callbackAdditionalArgs != null) {
      getFunction(callbackFnName)(
        { type, accessor_id, reference_id, request_id },
        ...callbackAdditionalArgs
      );
    } else {
      getFunction(callbackFnName)({
        type,
        accessor_id,
        reference_id,
        request_id,
      });
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
        getFunction(callbackFnName)(
          { error, type, accessor_id, reference_id, request_id },
          ...callbackAdditionalArgs
        );
      } else {
        getFunction(callbackFnName)({
          error,
          type,
          accessor_id,
          reference_id,
          request_id,
        });
      }
    }
  }
}
