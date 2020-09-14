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

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import * as utils from '../../utils';
import { callbackToClient } from '../../callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';
import { revokeIdentityAssociationAfterCloseConsentRequest } from './revoke_identity_association_after_consent';

/**
 * Revoke identity-IdP association from the platform
 * Use in mode 2,3
 *
 * @param {Object} revokeIdentityAssociationParams
 * @param {string} revokeIdentityAssociationParams.node_id
 * @param {string} revokeIdentityAssociationParams.reference_id
 * @param {string} revokeIdentityAssociationParams.callback_url
 * @param {string} revokeIdentityAssociationParams.namespace
 * @param {string} revokeIdentityAssociationParams.identifier
 * @param {string} revokeIdentityAssociationParams.request_message
 *
 * @returns {{ request_id: string }}
 */
export async function revokeIdentityAssociation(
  revokeIdentityAssociationParams,
  { apiVersion } = {}
) {
  let { node_id } = revokeIdentityAssociationParams;
  const {
    reference_id,
    callback_url,
    namespace,
    identifier,
    request_message,
  } = revokeIdentityAssociationParams;

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
    //identity not created yet
    if (identityOnNode == null) {
      throw new CustomError({
        errorType: errorType.IDENTITY_NOT_FOUND_ON_IDP,
        details: {
          namespace,
          identifier,
        },
      });
    }

    let request_id;
    if (identityOnNode.mode_list.includes(3)) {
      request_id = utils.createRequestId();
      if (request_message == null) {
        throw new CustomError({
          errorType: errorType.REQUEST_MESSAGE_NEEDED,
        });
      }
    }

    await cacheDb.setIdentityRequestDataByReferenceId(node_id, reference_id, {
      type: operationTypes.REVOKE_IDENTITY_ASSOCIATION,
      request_id,
    });

    await cacheDb.setCallbackUrlByReferenceId(
      node_id,
      reference_id,
      callback_url
    );

    revokeAssociationInternalAsync(...arguments, {
      nodeId: node_id,
      request_id,
      modeList: identityOnNode.mode_list,
    });
    return { request_id };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot revoke identity association',
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

async function revokeAssociationInternalAsync(
  { reference_id, callback_url, namespace, identifier, request_message },
  { apiVersion, ndidMemberAppType, ndidMemberAppVersion },
  { nodeId, request_id, modeList }
) {
  try {
    const mode = modeList.includes(3) ? 3 : 2;
    const min_idp = mode === 3 ? 1 : 0;

    const identity = {
      type: operationTypes.REVOKE_IDENTITY_ASSOCIATION,
      namespace,
      identifier,
      reference_id,
    };

    if (min_idp === 0) {
      revokeIdentityAssociationAfterCloseConsentRequest(
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
          callback_url: 'SYS_GEN_REVOKE_ASSOCIATION',
          data_request_list: [],
          request_message,
          min_ial: 1.1,
          min_aal: 1,
          min_idp,
          request_timeout: 86400,
          mode,
          purpose: operationTypes.REVOKE_IDENTITY_ASSOCIATION,
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName:
            'identity.revokeIdentityAssociationInternalAsyncAfterCreateRequestBlockchain',
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
          apiVersion,
          ndidMemberAppType,
          ndidMemberAppVersion,
        },
        { request_id }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Revoke identity association internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'revoke_identity_association_request_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await revokeIdentityAssociationCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function revokeIdentityAssociationInternalAsyncAfterCreateRequestBlockchain(
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
        type: 'revoke_identity_association_request_result',
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
      message:
        'Revoke identity association internal async after create request error',
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
        type: 'revoke_identity_association_request_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await revokeIdentityAssociationCleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

async function revokeIdentityAssociationCleanUpOnError({
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
