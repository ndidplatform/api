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
import { getRequestMessageForCreatingIdentity } from '../../utils/request_message';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import * as utils from '../../utils';
import { validateKey } from '../../utils/node_key';
import { callbackToClient } from '../../callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

// TODO: bring back synchronous?

/**
 * Register identity to the platform
 * Use in mode 2,3
 *
 * @param {Object} createIdentityParams
 * @param {string} createIdentityParams.node_id
 * @param {string} createIdentityParams.reference_id
 * @param {string} createIdentityParams.callback_url
 * @param {string} createIdentityParams.namespace
 * @param {string} createIdentityParams.identifier
 * @param {string} createIdentityParams.mode
 * @param {string} createIdentityParams.accessor_type
 * @param {string} createIdentityParams.accessor_public_key
 * @param {string} createIdentityParams.accessor_id
 * @param {number} createIdentityParams.ial
 * @param {string} createIdentityParams.request_message
 * @param {string} createIdentityParams.merge_to_namespace
 * @param {string} createIdentityParams.merge_to_identifier
 *
 * @returns {{ request_id: string, accessor_id: string }}
 */
export async function createIdentity(createIdentityParams) {
  let { node_id, ial, accessor_id } = createIdentityParams;
  const {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    merge_to_namespace,
    merge_to_identifier,
  } = createIdentityParams;

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

    if (
      (merge_to_namespace && !merge_to_identifier) ||
      (!merge_to_namespace && merge_to_identifier)
    ) {
      throw new CustomError({
        errorType: errorType.MISSING_IDENTITY_ARGUMENT_TO_MERGE,
      });
    }

    validateKey(accessor_public_key, accessor_type);

    ial = parseFloat(ial);

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

    const identityOnNode = await getIdentityInfo({
      nodeId: node_id,
      namespace,
      identifier,
    });
    //already created identity for this user
    if (identityOnNode != null) {
      throw new CustomError({
        errorType: errorType.IDENTITY_ALREADY_CREATED,
        details: {
          namespace,
          identifier,
        },
      });
    }

    //check ial
    let { max_ial } = await tendermintNdid.getNodeInfo(node_id);
    if (ial > max_ial) {
      throw new CustomError({
        errorType: errorType.MAXIMUM_IAL_EXCEED,
        details: {
          namespace,
          identifier,
        },
      });
    }

    if (!accessor_id) {
      accessor_id = utils.randomBase64Bytes(32);
    }

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
      type: 'RegisterIdentity',
      request_id,
      accessor_id,
    });

    const exist = await tendermintNdid.checkExistingIdentity({
      namespace,
      identifier,
    });

    let reference_group_code;
    if (merge_to_namespace && merge_to_identifier) {
      reference_group_code = await tendermintNdid.getReferenceGroupCode(
        merge_to_namespace,
        merge_to_identifier
      );
      if (!reference_group_code) {
        throw new CustomError({
          errorType: errorType.IDENTITY_TO_MERGE_TO_DOES_NOT_EXIST,
        });
      }
    } else if (!exist) {
      reference_group_code = utils.randomBase64Bytes(32);
    }

    await cacheDb.setCallbackUrlByReferenceId(
      node_id,
      reference_id,
      callback_url
    );

    createIdentityInternalAsync(...arguments, {
      nodeId: node_id,
      request_id,
      generated_accessor_id: accessor_id,
      exist,
      reference_group_code,
    });
    return { request_id, accessor_id };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create new identity',
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

async function createIdentityInternalAsync(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    mode,
    accessor_type,
    accessor_public_key,
    accessor_id,
    ial,
    request_message,
  },
  { nodeId, request_id, generated_accessor_id, exist, reference_group_code }
) {
  try {
    let min_idp;
    if (mode === 2) {
      min_idp = 0;
    } else if (mode === 3) {
      min_idp = exist ? 1 : 0;
    }

    await common.createRequest(
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
            : getRequestMessageForCreatingIdentity({
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
        purpose: 'RegisterIdentity',
      },
      {
        synchronous: false,
        sendCallbackToClient: false,
        callbackFnName:
          'identity.createIdentityInternalAsyncAfterCreateRequestBlockchain',
        callbackAdditionalArgs: [
          {
            reference_id,
            callback_url,
            namespace,
            identifier,
            mode,
            accessor_type,
            accessor_public_key,
            accessor_id,
            ial,
          },
          {
            nodeId,
            exist,
            request_id,
            generated_accessor_id,
            reference_group_code,
          },
        ],
        saveForRetryOnChainDisabled: true,
      },
      { request_id }
    );
  } catch (error) {
    logger.error({
      message: 'Create identity internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'create_identity_request_result',
        success: false,
        reference_id,
        request_id,
        accessor_id: accessor_id != null ? accessor_id : generated_accessor_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await createIdentityCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function createIdentityInternalAsyncAfterCreateRequestBlockchain(
  { chainId, height, error },
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    mode,
    accessor_type,
    accessor_public_key,
    accessor_id,
    ial,
  },
  { nodeId, exist, request_id, generated_accessor_id, reference_group_code }
) {
  try {
    if (error) throw error;

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'create_identity_request_result',
        reference_id,
        request_id,
        accessor_id: accessor_id != null ? accessor_id : generated_accessor_id,
        creation_block_height: `${chainId}:${height}`,
        success: true,
        exist,
      },
      retry: true,
    });

    const identity = {
      type: 'RegisterIdentity',
      namespace,
      identifier,
      ial,
      mode,
      accessor_id: accessor_id != null ? accessor_id : generated_accessor_id,
      accessor_public_key,
      accessor_type,
      reference_id,
    };

    if (exist && mode === 3) {
      // save data for later use after got consent from user (in mode 2,3)
      await cacheDb.setIdentityFromRequestId(nodeId, request_id, identity);
    } else {
      await common.closeRequest(
        {
          node_id: nodeId,
          request_id,
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName: 'identity.createIdentityAfterCloseConsentRequest',
          callbackAdditionalArgs: [
            { nodeId, request_id, reference_group_code, identity },
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
      message: 'Create identity internal async after create request error',
      tendermintResult: arguments[0],
      originalArgs: arguments[1],
      options: arguments[2],
      additionalArgs: arguments[3],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'create_identity_request_result',
        success: false,
        reference_id,
        request_id,
        accessor_id: accessor_id != null ? accessor_id : generated_accessor_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

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
