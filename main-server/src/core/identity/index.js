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

import operationTypes from './operation_type';

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import { callbackToClient } from '../../callback';
import * as utils from '../../utils';
import { getErrorObjectForClient } from '../../utils/error';
import logger from '../../logger';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import * as config from '../../config';
import { role } from '../../node';

export * from './create_identity';
export * from './create_identity_after_consent';
export * from './add_identity';
export * from './add_identity_after_consent';
export * from './update_ial';
export * from './add_accessor';
export * from './add_accessor_after_consent';
export * from './revoke_accessor';
export * from './revoke_accessor_after_consent';
export * from './revoke_and_add_accessor';
export * from './revoke_and_add_accessor_after_consent';
export * from './revoke_identity_association';
export * from './revoke_identity_association_after_consent';
export * from './upgrade_identity_mode';
export * from './upgrade_identity_mode_after_consent';
export * from './notification';

export async function getIdentityRequestDataByReferenceId(nodeId, referenceId) {
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

    const identityRequestData = await cacheDb.getIdentityRequestDataByReferenceId(
      nodeId,
      referenceId
    );

    if (identityRequestData == null) {
      return null;
    }

    switch (identityRequestData.type) {
      case operationTypes.REGISTER_IDENTITY:
      case operationTypes.ADD_ACCESSOR:
      case operationTypes.REVOKE_ACCESSOR:
        return {
          request_id: identityRequestData.request_id,
          accessor_id: identityRequestData.accessor_id,
        };
      case operationTypes.REVOKE_IDENTITY_ASSOCIATION:
      case operationTypes.ADD_IDENTITY:
      case operationTypes.UPDATE_IDENTITY_MODE_LIST:
        return {
          request_id: identityRequestData.request_id,
        };
      case operationTypes.REVOKE_AND_ADD_ACCESSOR:
        return {
          request_id: identityRequestData.request_id,
          revoking_accessor_id: identityRequestData.revoking_accessor_id,
          accessor_id: identityRequestData.accessor_id,
        };
      default:
        throw new CustomError({
          message: 'Unknown identity request data type',
          type: identityRequestData.type,
        });
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get identity request data by reference ID',
      cause: error,
    });
  }
}

export async function getIdentityInfo({
  nodeId,
  referenceGroupCode,
  namespace,
  identifier,
}) {
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

    const identityInfo = await tendermintNdid.getIdentityInfo({
      reference_group_code: referenceGroupCode,
      namespace,
      identifier,
      node_id: nodeId,
    });
    return identityInfo;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get identity info',
      cause: error,
    });
  }
}

export async function onReceiveIdpResponseForIdentity({ nodeId, message }) {
  const requestId = message.request_id;

  const request = await cacheDb.getRequestData(nodeId, requestId);
  if (request == null) return; //request not found

  const requestDetail = await tendermintNdid.getRequestDetail({
    requestId,
  });

  const requestStatus = utils.getRequestStatus(requestDetail);

  const responseValid = await common.getAndSaveIdpResponseValid({
    nodeId,
    requestDetail,
    requestDataFromMq: message,
  });

  let identityConsentRequestError;
  if (!responseValid.valid_signature || !responseValid.valid_ial) {
    identityConsentRequestError = new CustomError({
      errorType: errorType.INVALID_RESPONSE,
    });
  }

  const response = requestDetail.response_list[0];
  if (response.status !== 'accept') {
    identityConsentRequestError = new CustomError({
      errorType: errorType.USER_REJECTED,
    });
  }

  if (identityConsentRequestError != null) {
    await common.closeRequest(
      {
        node_id: nodeId,
        request_id: requestId,
      },
      {
        synchronous: false,
        sendCallbackToClient: false,
        callbackFnName: 'identity.afterCloseFailedIdentityConsentRequest',
        callbackAdditionalArgs: [
          { nodeId, requestId, identityConsentRequestError },
        ],
        saveForRetryOnChainDisabled: true,
        apiVersion: config.callbackApiVersion,
      }
    );
    return;
  }

  // Check if request is completed.
  const nonErrorAnsweredIdPCount = requestDetail.response_list.filter(
    (response) => response.error_code == null
  ).length;
  if (
    nonErrorAnsweredIdPCount === requestDetail.min_idp &&
    requestStatus === 'completed'
  ) {
    let callbackFnName;
    if (requestDetail.purpose === operationTypes.REGISTER_IDENTITY) {
      callbackFnName = 'identity.createIdentityAfterCloseConsentRequest';
    } else if (requestDetail.purpose === operationTypes.ADD_IDENTITY) {
      callbackFnName = 'identity.addIdentityAfterCloseConsentRequest';
    } else if (requestDetail.purpose === operationTypes.ADD_ACCESSOR) {
      callbackFnName = 'identity.addAccessorAfterCloseConsentRequest';
    } else if (requestDetail.purpose === operationTypes.REVOKE_ACCESSOR) {
      callbackFnName = 'identity.revokeAccessorAfterCloseConsentRequest';
    } else if (
      requestDetail.purpose === operationTypes.REVOKE_AND_ADD_ACCESSOR
    ) {
      callbackFnName = 'identity.revokeAndAddAccessorAfterCloseConsentRequest';
    } else if (
      requestDetail.purpose === operationTypes.REVOKE_IDENTITY_ASSOCIATION
    ) {
      callbackFnName =
        'identity.revokeIdentityAssociationAfterCloseConsentRequest';
    } else if (
      requestDetail.purpose === operationTypes.UPDATE_IDENTITY_MODE_LIST
    ) {
      callbackFnName = 'identity.upgradeIdentityModeAfterCloseConsentRequest';
    }
    await common.closeRequest(
      {
        node_id: nodeId,
        request_id: requestId,
      },
      {
        synchronous: false,
        sendCallbackToClient: false,
        callbackFnName,
        callbackAdditionalArgs: [
          { nodeId, request_id: requestId },
          {
            callbackFnName: 'identity.afterIdentityOperationSuccess',
            callbackAdditionalArgs: [{ nodeId }],
          },
        ],
        saveForRetryOnChainDisabled: true,
        apiVersion: config.callbackApiVersion,
      }
    );
  }
}

export async function afterIdentityOperationSuccess(
  {
    error,
    type,
    reference_group_code,
    accessor_id,
    revoking_accessor_id,
    reference_id,
    request_id,
  },
  { nodeId }
) {
  if (error && (type == null || reference_id == null)) {
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'idp.getErrorCallbackUrl',
      action: 'afterIdentityOperationSuccess',
      error,
      requestId: request_id,
    });
    return;
  }

  let callbackUrl;
  try {
    callbackUrl = await cacheDb.getCallbackUrlByReferenceId(
      nodeId,
      reference_id
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot get callback URL after identity operation success',
      cause: error,
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'idp.getErrorCallbackUrl',
      action: 'afterIdentityOperationSuccess',
      error: err,
      requestId: request_id,
    });
    return;
  }

  let typeCallback;
  if (type === operationTypes.REGISTER_IDENTITY) {
    typeCallback = 'create_identity_result';
  } else if (type === operationTypes.ADD_IDENTITY) {
    typeCallback = 'add_identity_result';
  } else if (type === operationTypes.ADD_ACCESSOR) {
    typeCallback = 'add_accessor_result';
  } else if (type === operationTypes.REVOKE_ACCESSOR) {
    typeCallback = 'revoke_accessor_result';
  } else if (type === operationTypes.REVOKE_AND_ADD_ACCESSOR) {
    typeCallback = 'revoke_and_add_accessor_result';
  } else if (type === operationTypes.REVOKE_IDENTITY_ASSOCIATION) {
    typeCallback = 'revoke_identity_association_result';
  } else if (type === operationTypes.UPDATE_IDENTITY_MODE_LIST) {
    typeCallback = 'upgrade_identity_mode_result';
  }
  try {
    if (error) throw error;

    await callbackToClient({
      callbackUrl,
      body: {
        node_id: nodeId,
        type: typeCallback,
        success: true,
        reference_id,
        request_id,
        reference_group_code, // For create_identity_result
      },
      retry: true,
    });
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing after identity operation success',
      cause: error,
    });
    logger.error({ err });

    await callbackToClient({
      callbackUrl,
      body: {
        node_id: nodeId,
        type: typeCallback,
        success: false,
        reference_id,
        request_id,
        revoking_accessor_id,
        accessor_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });
  } finally {
    cacheDb.removeCallbackUrlByReferenceId(nodeId, reference_id);
    cleanUpRequestData(nodeId, request_id, reference_id);
    cacheDb.removeIdentityRequestDataByReferenceId(nodeId, reference_id);
  }
}

export async function afterCloseFailedIdentityConsentRequest(
  { error },
  { nodeId, requestId, identityConsentRequestError }
) {
  try {
    if (error) throw error;
    const [identityData, requestData] = await Promise.all([
      cacheDb.getIdentityFromRequestId(nodeId, requestId),
      cacheDb.getRequestData(nodeId, requestId),
    ]);
    const reference_id = requestData.reference_id;
    const callbackUrl = await cacheDb.getCallbackUrlByReferenceId(
      nodeId,
      reference_id
    );
    if (identityData == null) {
      const err = new CustomError({
        message: 'Cannot get identity data',
        details: { requestId },
      });
      logger.error({ err });
      throw err;
    }
    let type;
    if (identityData.type === operationTypes.REGISTER_IDENTITY) {
      type = 'create_identity_result';
    } else if (identityData.type === operationTypes.ADD_IDENTITY) {
      type = 'add_identity_result';
    } else if (identityData.type === operationTypes.ADD_ACCESSOR) {
      type = 'add_accessor_result';
    } else if (identityData.type === operationTypes.REVOKE_ACCESSOR) {
      type = 'revoke_accessor_result';
    } else if (identityData.type === operationTypes.REVOKE_AND_ADD_ACCESSOR) {
      type = 'revoke_and_add_accessor_result';
    } else if (type === operationTypes.REVOKE_IDENTITY_ASSOCIATION) {
      type = 'revoke_identity_association_result';
    } else if (type === operationTypes.UPDATE_IDENTITY_MODE_LIST) {
      type = 'upgrade_identity_mode_result';
    }
    await callbackToClient({
      callbackUrl,
      body: {
        node_id: nodeId,
        type,
        success: false,
        reference_id,
        request_id: requestId,
        error: getErrorObjectForClient(identityConsentRequestError),
      },
      retry: true,
    });
    cacheDb.removeCallbackUrlByReferenceId(nodeId, reference_id);
    cacheDb.removeIdentityRequestDataByReferenceId(nodeId, reference_id);

    logger.debug({
      message: 'Identity consent request failed',
      err: identityConsentRequestError,
    });
  } catch (error) {
    const err = new CustomError({
      message: 'Error reporting unsuccessful identity consent request result',
      cause: error,
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'idp.getErrorCallbackUrl',
      action: 'afterCloseFailedIdentityConsentRequest',
      error: err,
      requestId,
    });
  }

  // logger.debug({
  //   message: 'Create identity request response valid and consented',
  // });
}

async function cleanUpRequestData(nodeId, requestId, referenceId) {
  return Promise.all([
    cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
    cacheDb.removeRequestData(nodeId, requestId),
    cacheDb.removeIdpResponseValidList(nodeId, requestId),
    cacheDb.removeRequestCreationMetadata(nodeId, requestId),
  ]);
}
