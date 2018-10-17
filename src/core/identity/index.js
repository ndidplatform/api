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
import { revokeIdentity } from './revoke_identity';

import * as tendermintNdid from '../../tendermint/ndid';
import { getFunction } from '../common';
import * as cacheDb from '../../db/cache';

import CustomError from '../../error/custom_error';
import errorType from '../../error/type';
import * as utils from '../../utils';
import { validateKey } from '../../utils/node_key';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

export * from './create_identity';
export * from './update_ial';
export * from './add_accessor_after_consent';
export * from './revoke_accessor_after_consent';

export async function checkAssociated({ node_id, namespace, identifier }) {
  let idpList = await tendermintNdid.getIdpNodes({
    namespace,
    identifier,
    min_aal: 1,
    min_ial: 1.1,
  });
  for (let i = 0; i < idpList.length; i++) {
    if (idpList[i].node_id === node_id) return true;
  }
  return false;
}

export async function addAccessorMethodForAssociatedIdp(
  {
    node_id,
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
    request_message,
  },
  { synchronous = false, apiVersion } = {}
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

  validateKey(accessor_public_key, accessor_type);

  const associated = await checkAssociated({
    node_id,
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
      node_id,
      reference_id,
      callback_url,
      namespace,
      identifier,
      accessor_type,
      accessor_public_key,
      accessor_id,
      request_message,
      addAccessor: true,
    },
    { synchronous, apiVersion }
  );
  return result;
}

export async function checkForExistedIdentity(
  { node_id, namespace, identifier, ial },
  { callbackFnName, callbackAdditionalArgs } = {}
) {
  const sid = namespace + ':' + identifier;
  const hash_id = utils.hash(sid);

  let exist = await tendermintNdid.checkExistingIdentity(hash_id);
  if (!exist) {
    if (callbackFnName != null) {
      await tendermintNdid.registerIdentity(
        {
          users: [
            {
              hash_id,
              ial,
              first: true,
            },
          ],
        },
        node_id,
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
        await tendermintNdid.registerIdentity(
          {
            users: [
              {
                hash_id,
                ial,
                first: true,
              },
            ],
          },
          node_id
        );
      } catch (error) {
        if (
          error.getCode &&
          error.getCode() === errorType.ABCI_NOT_FIRST_IDP.code
        ) {
          logger.debug({
            message:
              'Unable to register identity as the first IdP. Switching to ask for consent mode.',
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

export async function getCreateIdentityDataByReferenceId(nodeId, referenceId) {
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

    return await cacheDb.getCreateIdentityDataByReferenceId(
      nodeId,
      referenceId
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get create identity data by reference ID',
      cause: error,
    });
  }
}

export async function getIdentityInfo({ nodeId, namespace, identifier }) {
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

    const identityInfo = await tendermintNdid.getIdentityInfo(
      namespace,
      identifier,
      nodeId
    );
    return identityInfo;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get identity info',
      cause: error,
    });
  }
}

export async function revokeAccessorMethodForAssociatedIdp(
  {
    node_id,
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_id,
    request_message,
  },
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

  const associated = await checkAssociated({
    node_id,
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

  let accessor_public_key = await tendermintNdid.getAccessorKey(
    accessor_id
  );
  if (accessor_public_key == null) {
    throw new CustomError({
      errorType: errorType.ACCESSOR_PUBLIC_KEY_NOT_FOUND,
      details: {
        accessor_id,
      },
    });
  }

  //check is accessor_id created by this idp?
  const accessorOwner = await tendermintNdid.getAccessorOwner(accessor_id);
  if(accessorOwner !== node_id) {
    throw new CustomError({
      errorType: errorType.NOT_OWNER_OF_ACCESSOR,
      details: {
        accessor_id,
      },
    });
  }

  const result = await revokeIdentity(
    {
      node_id,
      reference_id,
      callback_url,
      namespace,
      identifier,
      accessor_id,
      request_message,
    },
  );
  return result;
}