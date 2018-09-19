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

import { getFunction } from '../common';

import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';

export async function addAccessorAfterConsent(
  { nodeId, request_id, old_accessor_id },
  { callbackFnName, callbackAdditionalArgs }
) {
  //NOTE: zero knowledge proof cannot be verify by blockchain, hence,
  //if this idp call to add their accessor it's imply that zk proof is verified by them
  logger.debug({
    message: 'Got consent, adding accessor',
    nodeId,
    request_id,
    old_accessor_id,
  });

  const accessor_group_id = await tendermintNdid.getAccessorGroupId(
    old_accessor_id
  );
  const {
    hash_id,
    ial,
    accessor_type,
    accessor_public_key,
    accessor_id,
    sid,
    associated,
    secret,
  } = await cacheDb.getIdentityFromRequestId(nodeId, request_id);

  await tendermintNdid.addAccessorMethod(
    {
      request_id,
      accessor_group_id,
      accessor_type,
      accessor_id,
      accessor_public_key,
    },
    nodeId,
    'identity.addAccessorAfterConsentAfterAddAccessorMethod',
    [
      {
        nodeId,
        request_id,
        hash_id,
        ial,
        secret,
        associated,
      },
      { callbackFnName, callbackAdditionalArgs },
    ]
  );
}

export async function addAccessorAfterConsentAfterAddAccessorMethod(
  { error },
  { nodeId, request_id, hash_id, ial, secret, associated },
  { callbackFnName, callbackAdditionalArgs } = {}
) {
  try {
    if (error) throw error;
    //no ial means old idp add new accessor
    if (ial) {
      await tendermintNdid.registerMqDestination(
        {
          users: [
            {
              hash_id,
              ial,
            },
          ],
        },
        nodeId,
        'identity.addAccessorAfterConsentAfterRegisterMqDest',
        [
          {
            nodeId,
            request_id,
            secret,
            associated,
          },
          { callbackFnName, callbackAdditionalArgs },
        ]
      );
    } else {
      await addAccessorAfterConsentAfterRegisterMqDest(
        {},
        {
          nodeId,
          request_id,
          secret,
          associated,
        },
        { callbackFnName, callbackAdditionalArgs }
      );
    }
  } catch (error) {
    logger.error({
      message:
        'Add accessor after consent after add accessor method to blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      error,
    });

    getFunction(callbackFnName)({ error });
  }
}

export async function addAccessorAfterConsentAfterRegisterMqDest(
  { error },
  { nodeId, request_id, secret, associated },
  { callbackFnName, callbackAdditionalArgs } = {}
) {
  try {
    if (error) throw error;

    await cacheDb.removeIdentityFromRequestId(nodeId, request_id);
    if (callbackAdditionalArgs != null) {
      getFunction(callbackFnName)(
        {
          secret,
          associated,
        },
        ...callbackAdditionalArgs
      );
    } else {
      getFunction(callbackFnName)({
        secret,
        associated,
      });
    }
  } catch (error) {
    logger.error({
      message:
        'Add accessor after consent after add register message queue address to blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      error,
    });

    getFunction(callbackFnName)({ error });
  }
}
