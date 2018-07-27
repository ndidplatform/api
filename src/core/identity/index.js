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

import { createIdentity } from './create_identity';

import logger from '../../logger';

import CustomError from '../../error/custom_error';
import errorType from '../../error/type';

import * as tendermintNdid from '../../tendermint/ndid';
import { getFunction, validateKeyType } from '../common';
import * as utils from '../../utils';
import * as config from '../../config';
import * as db from '../../db';

export * from './create_identity';
export * from './update_ial';

export async function checkAssociated({ namespace, identifier }) {
  let idpList = await tendermintNdid.getIdpNodes({
    namespace,
    identifier,
    min_aal: 1,
    min_ial: 1.1,
  });
  for (let i = 0; i < idpList.length; i++) {
    if (idpList[i].node_id === config.nodeId) return true;
  }
  return false;
}

export async function addAccessorMethodForAssociatedIdp(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
  },
  { synchronous = false, apiVersion } = {}
) {
  validateKeyType(accessor_public_key, accessor_type);

  const associated = await checkAssociated({
    namespace,
    identifier,
  });

  if (!associated) {
    throw new CustomError({
      message: errorType.IDENTITY_NOT_FOUND.message,
      code: errorType.IDENTITY_NOT_FOUND.code,
      clientError: true,
      details: {
        namespace,
        identifier,
      },
    });
  }

  const result = await createIdentity(
    {
      reference_id,
      callback_url,
      namespace,
      identifier,
      accessor_type,
      accessor_public_key,
      accessor_id,
      addAccessor: true,
    },
    { synchronous, apiVersion }
  );
  return result;
}

// FIXME: Refactor for broadcast_tx_sync with callback
export async function addAccessorAfterConsent(request_id, old_accessor_id) {
  //NOTE: zero knowledge proof cannot be verify by blockchain, hence,
  //if this idp call to add their accessor it's imply that zk proof is verified by the
  logger.debug({
    message: 'Get consent, adding accessor...',
    request_id,
    old_accessor_id,
  });

  let accessor_group_id = await tendermintNdid.getAccessorGroupId(
    old_accessor_id
  );
  let {
    hash_id,
    ial,
    accessor_type,
    accessor_public_key,
    accessor_id,
    sid,
    associated,
    secret,
  } = await db.getIdentityFromRequestId(request_id);

  let promiseArray = [
    tendermintNdid.addAccessorMethod({
      request_id,
      accessor_group_id,
      accessor_type,
      accessor_id,
      accessor_public_key,
    }),
  ];

  //no ial means old idp add new accessor
  if (ial)
    promiseArray.push(
      tendermintNdid.registerMqDestination({
        users: [
          {
            hash_id,
            ial,
          },
        ],
      })
    );

  await Promise.all(promiseArray);
  db.removeIdentityFromRequestId(request_id);

  return {
    secret,
    associated,
  };
}

export async function checkForExistedIdentity(
  { namespace, identifier, ial },
  { callbackFnName, callbackAdditionalArgs } = {}
) {
  const sid = namespace + ':' + identifier;
  const hash_id = utils.hash(sid);

  let exist = await tendermintNdid.checkExistingIdentity(hash_id);
  if (!exist) {
    if (callbackFnName != null) {
      await tendermintNdid.registerMqDestination(
        {
          users: [
            {
              hash_id,
              ial,
              first: true,
            },
          ],
        },
        'identity.checkForExistedIdentityAfterBlockchain',
        [
          {
            hash_id,
            exist,
          },
          {
            callbackFnName,
            callbackAdditionalArgs,
          },
        ]
      );
    } else {
      try {
        await tendermintNdid.registerMqDestination({
          users: [
            {
              hash_id,
              ial,
              first: true,
            },
          ],
        });
      } catch (error) {
        if (
          error.getCode &&
          error.getCode() === errorType.ABCI_NOT_FIRST_IDP.code
        ) {
          logger.debug({
            message:
              'Unable to register message queue destination for an identity as the first IdP. Switching to ask for consent mode.',
            hash_id,
          });
          exist = true;
        } else {
          throw error;
        }
      }
      return exist;
    }
  } else {
    if (callbackFnName != null) {
      checkForExistedIdentityAfterBlockchain(
        {},
        { hash_id, exist },
        { callbackFnName, callbackAdditionalArgs }
      );
    } else {
      return exist;
    }
  }
}

export function checkForExistedIdentityAfterBlockchain(
  { error },
  { hash_id, exist },
  { callbackFnName, callbackAdditionalArgs } = {}
) {
  let errorToReturn;
  if (error) {
    if (
      error.getCode &&
      error.getCode() === errorType.ABCI_NOT_FIRST_IDP.code
    ) {
      logger.debug({
        message:
          'Unable to register message queue destination for an identity as the first IdP. Switching to ask for consent mode.',
        hash_id,
      });
      exist = true;
    } else {
      errorToReturn = error;
    }
  }
  if (callbackFnName != null) {
    if (callbackAdditionalArgs != null) {
      getFunction(callbackFnName)(
        { exist, error: errorToReturn },
        ...callbackAdditionalArgs
      );
    } else {
      getFunction(callbackFnName)({ exist, error: errorToReturn });
    }
  }
}
