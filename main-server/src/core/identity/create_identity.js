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

import uuidv4 from 'uuid/v4';

import operationTypes from './operation_type';

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

import { createIdentityAfterCloseConsentRequest } from './create_identity_after_consent';

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
 * @param {Object[]} createIdentityParams.identity_list
 * @param {string} createIdentityParams.identity_list[].namespace
 * @param {string} createIdentityParams.identity_list[].identifier
 * @param {string} createIdentityParams.mode
 * @param {string} createIdentityParams.accessor_type
 * @param {string} createIdentityParams.accessor_public_key
 * @param {string} createIdentityParams.accessor_id
 * @param {number} createIdentityParams.ial
 * @param {string} createIdentityParams.request_message
 *
 * @returns {{ request_id: string, accessor_id: string }}
 */
export async function createIdentity(createIdentityParams) {
  let { node_id, ial, accessor_id } = createIdentityParams;
  const {
    reference_id,
    callback_url,
    identity_list,
    accessor_type,
    accessor_public_key,
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

    validateKey(accessor_public_key, accessor_type);

    ial = parseFloat(ial);

    const namespaceDetails = await tendermintNdid.getNamespaceList();
    let reference_group_code;
    let existingNamespace;
    let existingIdentifier;
    const new_identity_list = [];
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
          if (reference_group_code == null) {
            reference_group_code = identityReferenceGroupCode;
            existingNamespace = namespace;
            existingIdentifier = identifier;
          } else {
            if (reference_group_code !== identityReferenceGroupCode) {
              throw new CustomError({
                errorType: errorType.MULTIPLE_REFERENCE_GROUP_IN_IDENTITY_LIST,
              });
            }
          }
        } else {
          new_identity_list.push({
            namespace,
            identifier,
          });
        }
      })
    );
    if (reference_group_code == null) {
      reference_group_code = uuidv4();
    }

    //check ial
    const { max_ial } = await tendermintNdid.getNodeInfo(node_id);
    if (ial > max_ial) {
      throw new CustomError({
        errorType: errorType.MAXIMUM_IAL_EXCEED,
        details: {
          ial,
        },
      });
    }

    if (!accessor_id) {
      accessor_id = uuidv4();
    }

    const checkDuplicateAccessorId = await tendermintNdid.getAccessorKey(
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

    let request_id;
    if (existingNamespace && existingIdentifier) {
      request_id = utils.createRequestId();
    }

    await cacheDb.setIdentityRequestDataByReferenceId(node_id, reference_id, {
      type: operationTypes.REGISTER_IDENTITY,
      request_id,
      accessor_id,
    });

    await cacheDb.setCallbackUrlByReferenceId(
      node_id,
      reference_id,
      callback_url
    );

    createIdentityInternalAsync(...arguments, {
      nodeId: node_id,
      request_id,
      generated_accessor_id: accessor_id,
      reference_group_code,
      existingNamespace,
      existingIdentifier,
      new_identity_list,
    });

    return {
      request_id, // this prop exists only if consent request is needed (identity exists on platform)
      exist: !!(existingNamespace && existingIdentifier),
      accessor_id,
    };
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
    mode,
    accessor_type,
    accessor_public_key,
    accessor_id,
    ial,
    request_message,
  },
  {
    nodeId,
    request_id,
    generated_accessor_id,
    reference_group_code,
    existingNamespace,
    existingIdentifier,
    new_identity_list,
  }
) {
  try {
    let min_idp;
    let requestMode;
    if (mode === 2) {
      min_idp = 0;
      requestMode = 2;
    } else if (mode === 3) {
      if (existingNamespace && existingIdentifier) {
        min_idp = 1;

        const idpNodes = await tendermintNdid.getIdpNodes({
          namespace: existingNamespace,
          identifier: existingIdentifier,
        });
        requestMode = 2;
        for (let i = 0; i < idpNodes.length; i++) {
          const { mode_list } = idpNodes[i];
          if (mode_list.includes(3)) {
            requestMode = 3;
            break;
          }
        }
      } else {
        min_idp = 0;
        requestMode = 3;
      }
    }

    const identity = {
      type: operationTypes.REGISTER_IDENTITY,
      reference_group_code,
      new_identity_list,
      ial,
      mode,
      accessor_id: accessor_id != null ? accessor_id : generated_accessor_id,
      accessor_public_key,
      accessor_type,
      reference_id,
    };

    if (min_idp === 0) {
      createIdentityAfterCloseConsentRequest(
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
          namespace: existingNamespace
            ? existingNamespace
            : new_identity_list[0].namespace,
          identifier: existingIdentifier
            ? existingIdentifier
            : new_identity_list[0].identifier,
          reference_id,
          idp_id_list: [],
          callback_url: 'SYS_GEN_CREATE_IDENTITY',
          data_request_list: [],
          request_message:
            request_message != null
              ? request_message
              : getRequestMessageForCreatingIdentity({
                  namespace: existingNamespace,
                  identifier: existingIdentifier,
                  reference_id,
                  node_id: config.nodeId,
                }),
          min_ial: 1.1,
          min_aal: 1,
          min_idp,
          request_timeout: 86400,
          mode: requestMode,
          purpose: operationTypes.REGISTER_IDENTITY,
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
              accessor_id,
            },
            {
              nodeId,
              request_id,
              generated_accessor_id,
              existingNamespace,
              existingIdentifier,
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
  { reference_id, callback_url, accessor_id },
  {
    nodeId,
    request_id,
    generated_accessor_id,
    existingNamespace,
    existingIdentifier,
    identity,
  }
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
        exist: !!(existingNamespace && existingIdentifier),
      },
      retry: true,
    });

    // save data for later use after got consent from user (in mode 3)
    await cacheDb.setIdentityFromRequestId(nodeId, request_id, identity);
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
