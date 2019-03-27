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
export * from './update_ial';
export * from './add_accessor';
export * from './add_accessor_after_consent';
export * from './revoke_accessor';
export * from './revoke_accessor_after_consent';

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

    return await cacheDb.getIdentityRequestDataByReferenceId(
      nodeId,
      referenceId
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get create identity data by reference ID',
      cause: error,
    });
  }
}

export async function getRevokeAccessorDataByReferenceId(nodeId, referenceId) {
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

    return await cacheDb.getRevokeAccessorDataByReferenceId(
      nodeId,
      referenceId
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get revoke accessor data by reference ID',
      cause: error,
    });
  }
}

export async function getIdentityInfo({
  nodeId,
  namespace,
  identifier,
  referenceGroupCode,
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
      namespace,
      identifier,
      node_id: nodeId,
      reference_group_code: referenceGroupCode,
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

  const requestStatus = utils.getDetailedRequestStatus(requestDetail);

  const responseValid = await common.getAndSaveIdpResponseValid({
    nodeId,
    requestStatus,
    idpId: message.idp_id,
    requestDataFromMq: message,
    responseIal: requestDetail.response_list.find(
      (response) => response.idp_id === message.idp_id
    ).ial,
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
      }
    );
    return;
  }

  // Check if request is completed.
  if (
    requestStatus.answered_idp_count === requestStatus.min_idp &&
    requestStatus.status === 'completed'
  ) {
    let callbackFnName;
    if (requestDetail.purpose === 'RegisterIdentity') {
      callbackFnName = 'identity.createIdentityAfterCloseConsentRequest';
    } else if (requestDetail.purpose === 'AddAccessor') {
      callbackFnName = 'identity.addAccessorAfterCloseConsentRequest';
    } else if (requestDetail.purpose === 'RevokeAccessor') {
      callbackFnName = 'identity.revokeAccessorAfterCloseConsentRequest';
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
      }
    );
  }
}

export async function afterIdentityOperationSuccess(
  { error, type, reference_group_code, accessor_id, reference_id, request_id },
  { nodeId }
) {
  if (error && (type == null || accessor_id == null || reference_id == null)) {
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
  if (type === 'RegisterIdentity') {
    typeCallback = 'create_identity_result';
  } else if (type === 'AddAccessor') {
    typeCallback = 'add_accessor_result';
  } else if (type === 'RevokeAccessor') {
    typeCallback = 'revoke_accessor_result';
  }
  try {
    if (error) throw error;

    const requestData = await cacheDb.getRequestData(nodeId, request_id);
    const reference_id = requestData.reference_id;

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
    if (identityData.type === 'RegisterIdentity') {
      type = 'create_identity_result';
    } else if (identityData.type === 'AddAccessor') {
      type = 'add_accessor_result';
    } else if (identityData.type === 'RevokeAccessor') {
      type = 'revoke_accessor_result';
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
