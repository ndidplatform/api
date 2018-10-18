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


import * as common from '../common';
import * as cacheDb from '../../db/cache';
import { getRequestMessageForRevokingAccessor } from '../../utils/request_message';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

/**
 * Revoke identity
 * Use in mode 3
 *
 * @param {Object} revokeIdentityParams
 * @param {string} revokeIdentityParams.node_id
 * @param {string} revokeIdentityParams.reference_id
 * @param {string} revokeIdentityParams.callback_url
 * @param {string} revokeIdentityParams.namespace
 * @param {string} revokeIdentityParams.identifier
 * @param {string} revokeIdentityParams.accessor_id
 * @param {string} revokeIdentityParams.request_message
 * @param {Object} options
 * @param {boolean} options.synchronous
 * @param {number} options.apiVersion
 *
 * @returns {{ request_id: string }}
 */
export async function revokeIdentity(revokeIdentityParams) {
  let { node_id } = revokeIdentityParams;
  const {
    accessor_id,
    reference_id,
    callback_url,
    namespace,
    identifier,
  } = revokeIdentityParams;

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
    const revokeIdentityData = await cacheDb.getRevokeIdentityDataByReferenceId(
      node_id,
      reference_id
    );
    if (revokeIdentityData) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_REFERENCE_ID,
      });
    }

    const request_id = utils.createRequestId();

    await cacheDb.setRevokeIdentityDataByReferenceId(node_id, reference_id, {
      request_id,
      accessor_id,
      namespace,
      identifier,
    });

    await cacheDb.setAccessorIdToRevokeFromRequestId(node_id, request_id, accessor_id);

    await cacheDb.setCallbackUrlByReferenceId(
      node_id,
      reference_id,
      callback_url
    );
    createRequestToRevokeIdentity(...arguments, {
      nodeId: node_id,
      request_id,
    });
    return { request_id };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot revoke identity',
      cause: error,
    });
    logger.error(err.getInfoForLog());

    if (
      !(
        error.name === 'CustomError' &&
        error.code === errorType.DUPLICATE_REFERENCE_ID.code
      )
    ) {
      await Promise.all([
        cacheDb.removeRevokeIdentityDataByReferenceId(node_id, reference_id),
        cacheDb.removeCallbackUrlByReferenceId(node_id, reference_id),
      ]);
    }

    throw err;
  }
}

export async function createRequestToRevokeIdentity(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_id,
    request_message,
  },
  { nodeId, request_id }
) {
  try {
    await common.createRequest(
      {
        node_id: nodeId,
        namespace,
        identifier,
        reference_id,
        idp_id_list: [nodeId], //only self
        callback_url: 'SYS_GEN_REVOKE_IDENTITY',
        data_request_list: [],
        request_message:
          request_message != null
            ? request_message
            : getRequestMessageForRevokingAccessor({
                namespace,
                identifier,
                reference_id,
                node_id: config.nodeId,
                accessor_id
              }),
        //WHAT SHOULD IT BE?
        min_ial: 1.1,
        min_aal: 1,
        min_idp: 1,
        request_timeout: 86400,
        mode: 3,
        purpose: 'RevokeAccessor',
      },
      {
        synchronous: false,
        sendCallbackToClient: false,
        callbackFnName:
          'identity.notifyResultOfCreateRequestToRevokeIdentity',
        callbackAdditionalArgs: [
          {
            reference_id,
            callback_url,
            accessor_id,
          },
          {
            nodeId,
            request_id,
          },
        ],
      },
      { request_id }
    );
  } catch (error) {
    logger.error({
      message:
        'Revoke identity internal async error',
      originalArgs: arguments[0],
      additionalArgs: arguments[1],
      error,
    });

    await callbackToClient(
      callback_url,
      {
        node_id: nodeId,
        type: 'revoke_accessor_request_result',
        success: false,
        reference_id,
        request_id,
        accessor_id,
        error: getErrorObjectForClient(error),
      },
      true
    );

    await revokeIdentityCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function notifyResultOfCreateRequestToRevokeIdentity(
  { height, error },
  {
    reference_id,
    callback_url,
    accessor_id,
  },
  {
    nodeId,
    request_id,
  }
) {
  try {
    if (error) throw error;

    await cacheDb.setReferenceIdByRequestId(nodeId, request_id, reference_id);
    await callbackToClient(
      callback_url,
      {
        node_id: nodeId,
        type: 'revoke_accessor_request_result',
        reference_id,
        request_id,
        accessor_id,
        creation_block_height: height,
        success: true,
      },
      true
    );
  } catch (error) {
    logger.error({
      message: 'Create identity internal async after create request error',
      tendermintResult: arguments[0],
      originalArgs: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    await callbackToClient(
      callback_url,
      {
        node_id: nodeId,
        type: 'revoke_accessor_request_result',
        success: false,
        reference_id,
        request_id,
        accessor_id,
        error: getErrorObjectForClient(error),
      },
      true
    );

    await revokeIdentityCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

//=============================================================================

async function revokeIdentityCleanUpOnError({
  nodeId,
  requestId,
  referenceId,
}) {
  await Promise.all([
    cacheDb.removeCallbackUrlByReferenceId(nodeId, referenceId),
    cacheDb.removeReferenceIdByRequestId(nodeId, requestId),
    cacheDb.removeRevokeIdentityDataByReferenceId(nodeId, referenceId),
    cacheDb.removeAccessorIdToRevokeFromRequestId(nodeId, requestId),
  ]);
}