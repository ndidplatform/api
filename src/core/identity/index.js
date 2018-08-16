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
import { getFunction } from '../common';
import * as cacheDb from '../../db/cache';
import * as utils from '../../utils';
import * as config from '../../config';

export * from './create_identity';
export * from './update_ial';
export * from './add_accessor_after_consent';

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
  utils.validateKey(accessor_public_key, accessor_type);

  const associated = await checkAssociated({
    namespace,
    identifier,
  });

  if (!associated) {
    throw new CustomError({
      errorType: errorType.IDENTITY_NOT_FOUND,
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

export async function getCreateIdentityDataByReferenceId(referenceId) {
  try {
    return await cacheDb.getCreateIdentityDataByReferenceId(referenceId);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get create identity data by reference ID',
      cause: error,
    });
  }
}
