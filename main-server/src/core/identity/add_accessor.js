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

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import { getRequestMessageForAddingAccessor } from '../../utils/request_message';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import * as utils from '../../utils';
import { validateKey } from '../../utils/node_key';
import { callbackToClient } from '../../callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

/**
 * Add accessor to identity for IdP
 * Use in mode 2,3
 *
 * @param {Object} addAccessorParams
 * @param {string} addAccessorParams.node_id
 * @param {string} addAccessorParams.reference_id
 * @param {string} addAccessorParams.callback_url
 * @param {string} addAccessorParams.namespace
 * @param {string} addAccessorParams.identifier
 * @param {string} addAccessorParams.accessor_type
 * @param {string} addAccessorParams.accessor_public_key
 * @param {string} addAccessorParams.accessor_id
 * @param {string} addAccessorParams.request_message
 * @param {Object} options
 * @param {boolean} options.synchronous
 *
 * @returns {{ request_id: string, accessor_id: string }}
 */
export async function addAccessor(
  addAccessorParams,
  { synchronous = false } = {}
) {
  let { node_id, accessor_id } = addAccessorParams;
  const {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
  } = addAccessorParams;

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
    validateKey(accessor_public_key, accessor_type);

    const identityRequestData = await cacheDb.getIdentityRequestDataByReferenceId(
      node_id,
      reference_id
    );
    if (identityRequestData) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_REFERENCE_ID,
      });
    }

    const namespaceDetails = await tendermintNdid.getNamespaceList();
    const valid = namespaceDetails.find(
      (namespaceDetail) => namespaceDetail.namespace === namespace
    );
    if (!valid) {
      throw new CustomError({
        errorType: errorType.INVALID_NAMESPACE,
        details: {
          namespace,
        },
      });
    }

    if (!accessor_id) accessor_id = utils.randomBase64Bytes(32);

    let checkDuplicateAccessorId = await tendermintNdid.getAccessorKey(
      accessor_id
    );
    if (checkDuplicateAccessorId != null) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_ACCESSOR_ID,
        details: {
          accessor_id,
        },
      });
    }

    const request_id = utils.createRequestId();

    await cacheDb.setIdentityRequestDataByReferenceId(node_id, reference_id, {
      type: 'AddAccessor',
      request_id,
      accessor_id,
    });

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

    // Get maximum mode for identity
    let mode;
    if (identityOnNode.mode.find((mode) => mode === 3) != null) {
      mode = 3;
    } else if (identityOnNode.mode.find((mode) => mode === 2) != null) {
      mode = 2;
    } else {
      throw new CustomError({
        message: 'no available mode',
        // FIXME
      });
    }

    if (synchronous) {
      addAccessorInternalAsync(...arguments, {
        nodeId: node_id,
        request_id,
        mode,
        generated_accessor_id: accessor_id,
      });
      return { request_id, accessor_id };
    } else {
      await cacheDb.setCallbackUrlByReferenceId(
        node_id,
        reference_id,
        callback_url
      );

      addAccessorInternalAsync(...arguments, {
        nodeId: node_id,
        request_id,
        mode,
        generated_accessor_id: accessor_id,
      });
      return { request_id, accessor_id };
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot add accessor',
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

async function addAccessorInternalAsync(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
    request_message,
  },
  { synchronous = false } = {},
  { nodeId, request_id, mode, generated_accessor_id }
) {
  try {
    let min_idp;
    if (mode === 2) {
      min_idp = 0;
    } else if (mode === 3) {
      min_idp = 1;
    }

    if (!synchronous) {
      await common.createRequest(
        {
          node_id: nodeId,
          namespace,
          identifier,
          reference_id,
          idp_id_list: [],
          callback_url: 'SYS_GEN_ADD_ACCESSOR',
          data_request_list: [],
          request_message:
            request_message != null
              ? request_message
              : getRequestMessageForAddingAccessor({
                  namespace,
                  identifier,
                  reference_id,
                  node_id: config.nodeId,
                }),
          min_ial: 1.1,
          min_aal: 1,
          min_idp,
          request_timeout: 86400,
          mode,
          purpose: 'AddAccessor',
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName:
            'identity.addAccessorInternalAsyncAfterCreateRequestBlockchain',
          callbackAdditionalArgs: [
            {
              reference_id,
              callback_url,
              namespace,
              identifier,
              accessor_type,
              accessor_public_key,
              accessor_id,
            },
            { synchronous },
            {
              nodeId,
              request_id,
              mode,
              generated_accessor_id,
            },
          ],
          saveForRetryOnChainDisabled: true,
        },
        { request_id }
      );
    } else {
      const { chainId, height } = await common.createRequest(
        {
          node_id: nodeId,
          namespace,
          identifier,
          reference_id,
          idp_id_list: [],
          callback_url: 'SYS_GEN_CREATE_IDENTITY',
          data_request_list: [],
          request_message:
            request_message != null
              ? request_message
              : getRequestMessageForAddingAccessor({
                  namespace,
                  identifier,
                  reference_id,
                  node_id: config.nodeId,
                }),
          min_ial: 1.1,
          min_aal: 1,
          min_idp,
          request_timeout: 86400,
          mode,
          purpose: 'AddAccessor',
        },
        { synchronous: true },
        { request_id, mode }
      );
      await addAccessorInternalAsyncAfterCreateRequestBlockchain(
        { chainId, height },
        {
          reference_id,
          callback_url,
          namespace,
          identifier,
          accessor_type,
          accessor_public_key,
          accessor_id,
        },
        { synchronous },
        {
          nodeId,
          request_id,
          mode,
          generated_accessor_id,
        }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Add accessor internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'add_accessor_request_result',
          success: false,
          reference_id,
          request_id,
          accessor_id:
            accessor_id != null ? accessor_id : generated_accessor_id,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    }

    await createIdentityCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function addAccessorInternalAsyncAfterCreateRequestBlockchain(
  { chainId, height, error },
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
  },
  { synchronous = false } = {},
  { nodeId, request_id, mode, generated_accessor_id }
) {
  try {
    if (error) throw error;

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'add_accessor_request_result',
          reference_id,
          request_id,
          accessor_id,
          creation_block_height: `${chainId}:${height}`,
          success: true,
        },
        retry: true,
      });
    }

    const identity = {
      type: 'AddAccessor',
      namespace,
      identifier,
      accessor_id,
      accessor_public_key,
      accessor_type,
      reference_id,
    };
    if (mode === 3) {
      // save data for later use after got consent from user (in mode 2,3)
      await cacheDb.setIdentityFromRequestId(nodeId, request_id, identity);
    } else {
      // TODO: bring back synchronous?
      await common.closeRequest(
        {
          node_id: nodeId,
          request_id,
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName: 'identity.addAccessorAfterCloseConsentRequest',
          callbackAdditionalArgs: [
            { nodeId, request_id, identity },
            {
              callbackFnName: 'identity.afterIdentityOperationSuccess',
              callbackAdditionalArgs: [{ nodeId }],
            },
          ],
          saveForRetryOnChainDisabled: true,
        }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Add accessor internal async after create request error',
      tendermintResult: arguments[0],
      originalArgs: arguments[1],
      options: arguments[2],
      additionalArgs: arguments[3],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'add_accessor_request_result',
          success: false,
          reference_id,
          request_id,
          accessor_id:
            accessor_id != null ? accessor_id : generated_accessor_id,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    }

    await createIdentityCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

async function createIdentityCleanUpOnError({
  nodeId,
  requestId,
  referenceId,
}) {
  await Promise.all([
    cacheDb.removeCallbackUrlByReferenceId(nodeId, referenceId),
    cacheDb.removeIdentityRequestDataByReferenceId(nodeId, referenceId),
    cacheDb.removeIdentityFromRequestId(nodeId, requestId),
  ]);
}
