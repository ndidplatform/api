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
import { callbackToClient } from '../../callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

// TODO: bring back synchronous?

/**
 * Merge 2 identities to one on the platform
 * Use in mode 2,3
 *
 * @param {Object} mergeReferenceGroupParams
 * @param {string} mergeReferenceGroupParams.node_id
 * @param {string} mergeReferenceGroupParams.reference_id
 * @param {string} mergeReferenceGroupParams.callback_url
 * @param {string} mergeReferenceGroupParams.namespace
 * @param {string} mergeReferenceGroupParams.identifier
 * @param {string} mergeReferenceGroupParams.namespace_to_merge
 * @param {string} mergeReferenceGroupParams.identifier_to_merge
 * @param {string} mergeReferenceGroupParams.request_message
 *
 * @returns {{ request_id: string }}
 */
export async function mergeReferenceGroup(mergeReferenceGroupParams) {
  let { node_id } = mergeReferenceGroupParams;
  const {
    reference_id,
    callback_url,
    namespace,
    identifier,
    namespace_to_merge,
    identifier_to_merge,
  } = mergeReferenceGroupParams;

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

    const namespaceDetails = await tendermintNdid.getNamespaceList();
    const valid = namespaceDetails.find(
        (namespaceDetail) => namespaceDetail.namespace === namespace);
    const validMerge = namespaceDetails.find(
        (namespaceDetail) => namespaceDetail.namespace === namespace_to_merge);

    if (!valid) {
      throw new CustomError({
        errorType: errorType.INVALID_NAMESPACE,
        details: {
          namespace,
        },
      });
    }
    if (!validMerge) {
      throw new CustomError({
        errorType: errorType.INVALID_NAMESPACE,
        details: {
          namespace_to_merge,
        },
      });
    }

    const identityOnNode = await getIdentityInfo({
      nodeId: node_id,
      namespace: namespace_to_merge,
      identifier: identifier_to_merge,
    });
    //already created identity for this user
    if (identityOnNode == null) {
      throw new CustomError({
        errorType: errorType.IDENTITY_NOT_FOUND,
        details: {
          namespace: namespace_to_merge,
          identifier: identifier_to_merge,
        },
      });
    }

    const exist = await tendermintNdid.checkExistingIdentity({
      namespace,
      identifier,
    });
    if(!exist) {
      throw new CustomError({
        errorType: errorType.IDENTITY_NOT_FOUND,
        details: {
          namespace,
          identifier,
        }
      });
    }

    const request_id_list = [utils.createRequestId(), utils.createRequestId()];

    await cacheDb.setIdentityRequestDataByReferenceId(node_id, reference_id, {
      type: 'RegisterIdentity',
      request_id_list,
    });

    await cacheDb.setCallbackUrlByReferenceId(
      node_id,
      reference_id,
      callback_url
    );

    mergeReferenceGroupInternalAsync(...arguments, {
      nodeId: node_id,
      request_id_list,
      modeList: identityOnNode.modeList,
    });
    return { 
      request_id: request_id_list[0],
      group_to_merge_request_id: request_id_list[1],
    };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot merge reference group',
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

async function mergeReferenceGroupInternalAsync(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    namespace_to_merge,
    identifier_to_merge,
    request_message,
  },
  { nodeId, request_id_list, modeList }
) {
  try {
    let min_idp = 0, mode = 2;
    if (modeList.indexOf(3) !== -1) {
      min_idp = 1;
      mode = 3;
    }

    await Promise.all([
      common.createRequest(
        {
          node_id: nodeId,
          namespace,
          identifier,
          reference_id,
          idp_id_list: [],
          callback_url: 'SYS_GEN_MERGE_IDENTITY',
          data_request_list: [],
          request_message:
            request_message != null
              ? request_message
              : getRequestMessageForMergeIdentity({
                  namespace,
                  identifier,
                  namespace_to_merge,
                  identifier_to_merge,
                  reference_id,
                  node_id: config.nodeId,
                }),
          min_ial: 1.1,
          min_aal: 1,
          min_idp,
          request_timeout: 86400,
          mode,
          purpose: 'MergeIdentity',
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName:
            'identity.mergeReferenceGroupInternalAsyncAfterCreateRequestBlockchain',
          callbackAdditionalArgs: [
            {
              reference_id,
              callback_url,
              namespace,
              identifier,
              mode,
            },
            {
              nodeId,
              request_id: request_id_list[0],
            },
          ],
          saveForRetryOnChainDisabled: true,
        },
        { request_id: request_id_list[0] }
      ),
      common.createRequest(
        {
          node_id: nodeId,
          namespace: namespace_to_merge,
          identifier: identifier_to_merge,
          reference_id,
          idp_id_list: [],
          callback_url: 'SYS_GEN_MERGE_IDENTITY',
          data_request_list: [],
          request_message:
            request_message != null
              ? request_message
              : getRequestMessageForMergeIdentity({
                  namespace,
                  identifier,
                  namespace_to_merge,
                  identifier_to_merge,
                  reference_id,
                  node_id: config.nodeId,
                }),
          min_ial: 1.1,
          min_aal: 1,
          min_idp,
          request_timeout: 86400,
          mode,
          purpose: 'MergeIdentity',
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName:
            'identity.mergeReferenceGroupInternalAsyncAfterCreateRequestBlockchain',
          callbackAdditionalArgs: [
            {
              reference_id,
              callback_url,
              namespace,
              identifier,
              mode,
            },
            {
              nodeId,
              request_id: request_id_list[0],
            },
          ],
          saveForRetryOnChainDisabled: true,
        },
        { request_id: request_id_list[0] }
      ),
    ]);
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

    await mergeReferenceGroupCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function mergeReferenceGroupInternalAsyncAfterCreateRequestBlockchain(
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
  { nodeId, exist, request_id, generated_accessor_id }
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
    let reference_group_code;
    if (!exist) {
      reference_group_code = utils.randomBase64Bytes(32);
    }
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
          callbackFnName: 'identity.mergeReferenceGroupAfterCloseConsentRequest',
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

    await mergeReferenceGroupCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

async function mergeReferenceGroupCleanUpOnError({
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
