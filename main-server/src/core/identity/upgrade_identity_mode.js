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

// TODO: bring back synchronous?

/**
 * Upgrade identity mode from mode 2 to mode 3
 *
 * @param {Object} upgradeIdentityModeParams
 * @param {string} upgradeIdentityModeParams.node_id
 * @param {string} upgradeIdentityModeParams.reference_id
 * @param {string} upgradeIdentityModeParams.callback_url
 * @param {string} upgradeIdentityModeParams.namespace
 * @param {string} upgradeIdentityModeParams.identifier
 * @param {string} upgradeIdentityModeParams.request_message
 *
 * @returns {{ request_id: string }}
 */
export async function upgradeIdentityMode(
  upgradeIdentityModeParams,
  { apiVersion }
) {
  let { node_id } = upgradeIdentityModeParams;
  const {
    reference_id,
    callback_url,
    namespace,
    identifier,
    request_message,
  } = upgradeIdentityModeParams;

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
    if (identityOnNode == null) {
      throw new CustomError({
        errorType: errorType.IDENTITY_NOT_FOUND_ON_IDP,
        details: {
          namespace,
          identifier,
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

    if (mode === 3) {
      throw new CustomError({
        errorType: errorType.MODE_ALREADY_UPGRADED,
      });
    }

    const request_id = utils.createRequestId();

    if (request_message == null) {
      throw new CustomError({
        errorType: errorType.REQUEST_MESSAGE_NEEDED,
      });
    }

    let requestMode;
    const idpNodes = await tendermintNdid.getIdpNodes({
      namespace,
      identifier,
    });
    requestMode = 2;
    for (let i = 0; i < idpNodes.length; i++) {
      const { mode_list } = idpNodes[i];
      if (mode_list.includes(3)) {
        requestMode = 3;
        break;
      }
    }

    await cacheDb.setIdentityRequestDataByReferenceId(node_id, reference_id, {
      type: operationTypes.UPDATE_IDENTITY_MODE_LIST,
      request_id,
    });

    await cacheDb.setCallbackUrlByReferenceId(
      node_id,
      reference_id,
      callback_url
    );

    upgradeIdentityModeInternalAsync(...arguments, {
      nodeId: node_id,
      request_id,
      requestMode,
    });
    return { request_id };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot upgrade identity mode',
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

async function upgradeIdentityModeInternalAsync(
  { reference_id, callback_url, namespace, identifier, request_message },
  { apiVersion },
  { nodeId, request_id, requestMode }
) {
  try {
    const min_idp = 1;

    const identity = {
      type: operationTypes.UPDATE_IDENTITY_MODE_LIST,
      namespace,
      identifier,
      reference_id,
    };

    await common.createRequest(
      {
        node_id: nodeId,
        namespace,
        identifier,
        reference_id,
        idp_id_list: [],
        callback_url: 'SYS_GEN_UPGRADE_IDENTITY_MODE',
        data_request_list: [],
        request_message,
        min_ial: 1.1,
        min_aal: 1,
        min_idp,
        request_timeout: 86400,
        mode: requestMode,
        purpose: operationTypes.UPDATE_IDENTITY_MODE_LIST,
      },
      {
        synchronous: false,
        sendCallbackToClient: false,
        callbackFnName:
          'identity.upgradeIdentityModeInternalAsyncAfterCreateRequestBlockchain',
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
      },
      { request_id }
    );
  } catch (error) {
    logger.error({
      message: 'Upgrade identity mode internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'upgrade_identity_mode_request_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await cleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function upgradeIdentityModeInternalAsyncAfterCreateRequestBlockchain(
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
        type: 'upgrade_identity_mode_request_result',
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
        'Upgrade identity mode internal async after create request error',
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
        type: 'upgrade_identity_mode_request_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });

    await cleanUpOnError({
      nodeId,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

async function cleanUpOnError({ nodeId, requestId, referenceId }) {
  await Promise.all([
    cacheDb.removeCallbackUrlByReferenceId(nodeId, referenceId),
    cacheDb.removeIdentityRequestDataByReferenceId(nodeId, referenceId),
    cacheDb.removeIdentityFromRequestId(nodeId, requestId),
  ]);
}
