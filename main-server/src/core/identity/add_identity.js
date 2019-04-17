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

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import { getRequestMessageForAddingIdentity } from '../../utils/request_message';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import * as utils from '../../utils';
import { callbackToClient } from '../../callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';
import { addIdentityAfterCloseConsentRequest } from './add_identity_after_consent';

// TODO: bring back synchronous?

/**
 * Add identity to the platform
 * Use in mode 2,3
 *
 * @param {Object} addIdentityParams
 * @param {string} addIdentityParams.node_id
 * @param {string} addIdentityParams.reference_id
 * @param {string} addIdentityParams.callback_url
 * @param {string} addIdentityParams.namespace
 * @param {string} addIdentityParams.identifier
 * @param {string} addIdentityParams.identity_list
 * @param {string} addIdentityParams.request_message
 *
 * @returns {{ request_id: string }}
 */
export async function addIdentity(addIdentityParams) {
  let { node_id } = addIdentityParams;
  const {
    reference_id,
    callback_url,
    namespace,
    identifier,
    identity_list,
  } = addIdentityParams;

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

    const reference_group_code = await tendermintNdid.getReferenceGroupCode(
      namespace,
      identifier
    );
    const namespaceDetails = await tendermintNdid.getNamespaceList();
    await Promise.all(
      identity_list.map(async ({ namespace, identifier }) => {
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

        const identityReferenceGroupCode = await tendermintNdid.getReferenceGroupCode(
          namespace,
          identifier
        );

        if (identityReferenceGroupCode != null) {
          if (reference_group_code !== identityReferenceGroupCode) {
            throw new CustomError({
              errorType: errorType.MULTIPLE_REFERENCE_GROUP_IN_IDENTITY_LIST,
            });
          }
        }
      })
    );

    const identityOnNode = await getIdentityInfo({
      nodeId: node_id,
      namespace,
      identifier,
    });

    if (identityOnNode == null) {
      throw new CustomError({
        errorType: errorType.IDENTITY_NOT_FOUND_ON_IDP,
        details: {
          namespace,
          identifier,
        },
      });
    }

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
      type: operationTypes.ADD_IDENTITY,
      request_id,
    });

    await cacheDb.setCallbackUrlByReferenceId(
      node_id,
      reference_id,
      callback_url
    );

    addIdentityInternalAsync(...arguments, {
      nodeId: node_id,
      request_id,
      mode,
    });
    return { request_id };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot add identity',
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

async function addIdentityInternalAsync(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    identity_list,
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
      type: operationTypes.ADD_IDENTITY,
      namespace,
      identifier,
      identity_list,
      reference_id,
    };

    if (min_idp === 0) {
      addIdentityAfterCloseConsentRequest(
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
          callback_url: 'SYS_GEN_ADD_IDENTITY',
          data_request_list: [],
          request_message:
            request_message != null
              ? request_message
              : getRequestMessageForAddingIdentity({
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
          purpose: operationTypes.ADD_IDENTITY,
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName:
            'identity.addIdentityInternalAsyncAfterCreateRequestBlockchain',
          callbackAdditionalArgs: [
            {
              reference_id,
              callback_url,
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
      message: 'Add identity internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'add_identity_request_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await identityCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function addIdentityInternalAsyncAfterCreateRequestBlockchain(
  { chainId, height, error },
  { reference_id, callback_url },
  { nodeId, request_id, identity }
) {
  try {
    if (error) throw error;

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'add_identity_request_result',
        reference_id,
        request_id,
        creation_block_height: `${chainId}:${height}`,
        success: true,
      },
      retry: true,
    });

    // save data for later use after got consent from user (in mode 3)
    await cacheDb.setIdentityFromRequestId(nodeId, request_id, identity);
  } catch (error) {
    logger.error({
      message: 'Add identity internal async after create request error',
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
        type: 'add_identity_request_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await identityCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

async function identityCleanUpOnError({ nodeId, requestId, referenceId }) {
  await Promise.all([
    cacheDb.removeCallbackUrlByReferenceId(nodeId, referenceId),
    cacheDb.removeIdentityRequestDataByReferenceId(nodeId, referenceId),
    cacheDb.removeIdentityFromRequestId(nodeId, requestId),
  ]);
}
