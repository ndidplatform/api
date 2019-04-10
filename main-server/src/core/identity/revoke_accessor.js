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

import { getIdentityInfo } from '.';

import operationTypes from './operation_type';

import * as common from '../common';
import * as cacheDb from '../../db/cache';
import * as tendermintNdid from '../../tendermint/ndid';
import { getRequestMessageForRevokingAccessor } from '../../utils/request_message';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import * as utils from '../../utils';
import { callbackToClient } from '../../callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

import { revokeAccessorAfterCloseConsentRequest } from './revoke_accessor_after_consent';

/**
 * Revoke identity
 * Use in mode 2,3
 *
 * @param {Object} revokeAccessorParams
 * @param {string} revokeAccessorParams.node_id
 * @param {string} revokeAccessorParams.reference_id
 * @param {string} revokeAccessorParams.callback_url
 * @param {string} revokeAccessorParams.namespace
 * @param {string} revokeAccessorParams.identifier
 * @param {string} revokeAccessorParams.accessor_id
 * @param {string} revokeAccessorParams.request_message
 *
 * @returns {{ request_id: string }}
 */
export async function revokeAccessor(revokeAccessorParams) {
  let { node_id } = revokeAccessorParams;
  const {
    accessor_id,
    reference_id,
    callback_url,
    namespace,
    identifier,
  } = revokeAccessorParams;

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
    const identityRequestData = await cacheDb.getIdentityRequestDataByReferenceId(
      node_id,
      reference_id
    );
    if (identityRequestData) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_REFERENCE_ID,
      });
    }

    const identityOnNode = await getIdentityInfo({
      nodeId: node_id,
      namespace,
      identifier,
    });
    if (identityOnNode == null) {
      throw new CustomError({
        errorType: errorType.IDENTITY_NOT_FOUND,
        details: {
          namespace,
          identifier,
        },
      });
    }

    const accessor_public_key = await tendermintNdid.getAccessorKey(
      accessor_id
    );
    if (accessor_public_key == null) {
      throw new CustomError({
        errorType: errorType.ACCESSOR_PUBLIC_KEY_NOT_FOUND_OR_NOT_ACTIVE,
        details: {
          accessor_id,
        },
      });
    }

    //check is accessor_id created by this idp?
    const accessorOwner = await tendermintNdid.getAccessorOwner(accessor_id);
    if (accessorOwner !== node_id) {
      throw new CustomError({
        errorType: errorType.NOT_OWNER_OF_ACCESSOR,
        details: {
          accessor_id,
        },
      });
    }

    // Get maximum mode for identity
    let mode;
    if (identityOnNode.mode_list.find((mode) => mode === 3) != null) {
      mode = 3;
    } else if (identityOnNode.mode_list.find((mode) => mode === 2) != null) {
      mode = 2;
    } else {
      throw new CustomError({
        errorType: errorType.NO_MODE_AVAILABLE,
      });
    }

    let request_id;
    if (mode === 3) {
      request_id = utils.createRequestId();
    }

    await cacheDb.setIdentityRequestDataByReferenceId(node_id, reference_id, {
      type: operationTypes.REVOKE_ACCESSOR,
      request_id,
      accessor_id,
      namespace,
      identifier,
    });

    await cacheDb.setCallbackUrlByReferenceId(
      node_id,
      reference_id,
      callback_url
    );

    createRequestToRevokeAccessor(...arguments, {
      nodeId: node_id,
      request_id,
      mode,
    });
    return { request_id };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot revoke identity',
      cause: error,
    });
    logger.error({ err });

    if (
      !(
        error.name === 'CustomError' &&
        error.code === errorType.DUPLICATE_REFERENCE_ID.code
      )
    ) {
      await Promise.all([
        cacheDb.removeIdentityRequestDataByReferenceId(node_id, reference_id),
        cacheDb.removeCallbackUrlByReferenceId(node_id, reference_id),
      ]);
    }

    throw err;
  }
}

async function createRequestToRevokeAccessor(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_id,
    request_message,
  },
  { nodeId, request_id, mode }
) {
  try {
    let min_idp;
    if (mode === 2) {
      min_idp = 0;
    } else if (mode === 3) {
      min_idp = 1;
    }

    const identity = {
      type: operationTypes.REVOKE_ACCESSOR,
      namespace,
      identifier,
      accessor_id,
      reference_id,
    };

    if (min_idp === 0) {
      revokeAccessorAfterCloseConsentRequest(
        {},
        {
          nodeId,
          identity,
        },
        {
          callbackFnName: 'identity.afterIdentityOperationSuccess',
          callbackAdditionalArgs: [{ nodeId }],
        }
      );
    } else {
      await common.createRequest(
        {
          node_id: nodeId,
          namespace,
          identifier,
          reference_id,
          idp_id_list: [],
          callback_url: 'SYS_GEN_REVOKE_ACCESSOR',
          data_request_list: [],
          request_message:
            request_message != null
              ? request_message
              : getRequestMessageForRevokingAccessor({
                  namespace,
                  identifier,
                  reference_id,
                  node_id: config.nodeId,
                  accessor_id,
                }),
          // WHAT SHOULD THESE BE? (IAL, AAL, MIN_IDP)
          min_ial: 1.1,
          min_aal: 1,
          min_idp,
          request_timeout: 86400,
          mode,
          purpose: operationTypes.REVOKE_ACCESSOR,
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName:
            'identity.notifyResultOfCreateRequestToRevokeAccessor',
          callbackAdditionalArgs: [
            {
              reference_id,
              callback_url,
              accessor_id,
            },
            {
              nodeId,
              request_id,
              identity,
            },
          ],
          saveForRetryOnChainDisabled: true,
        },
        { request_id }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Revoke accessor internal async error',
      originalArgs: arguments[0],
      additionalArgs: arguments[1],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'revoke_accessor_request_result',
        success: false,
        reference_id,
        request_id,
        accessor_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await revokeAccessorCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function notifyResultOfCreateRequestToRevokeAccessor(
  { chainId, height, error },
  { reference_id, callback_url, accessor_id },
  { nodeId, request_id, identity }
) {
  try {
    if (error) throw error;

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'revoke_accessor_request_result',
        reference_id,
        request_id,
        accessor_id,
        creation_block_height: `${chainId}:${height}`,
        success: true,
      },
      retry: true,
    });

    // save data for later use after got consent from user (in mode 3)
    await cacheDb.setIdentityFromRequestId(nodeId, request_id, identity);
  } catch (error) {
    logger.error({
      message: 'Revoke accessor internal async after create request error',
      tendermintResult: arguments[0],
      originalArgs: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'revoke_accessor_request_result',
        success: false,
        reference_id,
        request_id,
        accessor_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await revokeAccessorCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

async function revokeAccessorCleanUpOnError({
  nodeId,
  requestId,
  referenceId,
}) {
  await Promise.all([
    cacheDb.removeCallbackUrlByReferenceId(nodeId, referenceId),
    cacheDb.removeIdentityRequestDataByReferenceId(nodeId, referenceId),
    cacheDb.removeAccessorIdToRevokeFromRequestId(nodeId, requestId),
  ]);
}
