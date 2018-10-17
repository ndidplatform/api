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

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

import { verifySignature } from '../../utils';
import { callbackToClient } from '../../utils/callback';
import CustomError from '../../error/custom_error';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';
import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as utils from '../../utils';
import * as config from '../../config';
import * as cacheDb from '../../db/cache';
import * as identity from '../identity';
import privateMessageType from '../private_message_type';

export * from './create_response';
export * from './event_handlers';

export const callbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  config.dataDirectoryPath,
  'idp-callback-url-' + config.nodeId
);

export function readCallbackUrlsFromFiles() {
  [
    { key: 'incoming_request_url', fileSuffix: 'incoming_request' },
    { key: 'identity_result_url', fileSuffix: 'identity_result' },
    { key: 'accessor_sign_url', fileSuffix: 'accessor_sign' },
    { key: 'error_url', fileSuffix: 'error' },
  ].forEach(({ key, fileSuffix }) => {
    try {
      callbackUrls[key] = fs.readFileSync(
        callbackUrlFilesPrefix + '-' + fileSuffix,
        'utf8'
      );
      logger.info({
        message: `[IdP] ${fileSuffix} callback url read from file`,
        callbackUrl: callbackUrls[key],
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn({
          message: `[IdP] ${fileSuffix} callback url file not found`,
        });
      } else {
        logger.error({
          message: `[IdP] Cannot read ${fileSuffix} callback url file`,
          error,
        });
      }
    }
  });
}

function writeCallbackUrlToFile(fileSuffix, url) {
  fs.writeFile(callbackUrlFilesPrefix + '-' + fileSuffix, url, (err) => {
    if (err) {
      logger.error({
        message: `[IdP] Cannot write ${fileSuffix} callback url file`,
        error: err,
      });
    }
  });
}

export function setCallbackUrls({
  incoming_request_url,
  identity_result_url,
  accessor_sign_url,
  error_url,
}) {
  if (incoming_request_url != null) {
    callbackUrls.incoming_request_url = incoming_request_url;
    writeCallbackUrlToFile('incoming_request', incoming_request_url);
  }
  if (identity_result_url != null) {
    callbackUrls.identity_result_url = identity_result_url;
    writeCallbackUrlToFile('identity_result', identity_result_url);
  }
  if (accessor_sign_url != null) {
    callbackUrls.accessor_sign_url = accessor_sign_url;
    writeCallbackUrlToFile('accessor_sign', accessor_sign_url);
  }
  if (error_url != null) {
    callbackUrls.error_url = error_url;
    writeCallbackUrlToFile('error', error_url);
  }
}

export function getCallbackUrls() {
  return callbackUrls;
}

export function getErrorCallbackUrl() {
  return callbackUrls.error_url;
}

export function isAccessorSignUrlSet() {
  return callbackUrls.accessor_sign_url != null;
}

export async function accessorSign({
  node_id,
  sid,
  hash_id,
  accessor_id,
  accessor_public_key,
  reference_id,
}) {
  const data = {
    sid_hash: hash_id,
    sid,
    hash_method: 'SHA256',
    key_type: 'RSA',
    sign_method: 'RSA-SHA256',
    type: 'accessor_sign',
    padding: 'PKCS#1v1.5',
    accessor_id,
    reference_id,
    node_id,
  };

  if (callbackUrls.accessor_sign_url == null) {
    throw new CustomError({
      errorType: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET,
    });
  }

  logger.debug({
    message: 'Callback to accessor sign',
    url: callbackUrls.accessor_sign_url,
    reference_id,
    accessor_id,
    accessor_public_key,
    hash_id,
  });

  try {
    const response = await fetch(callbackUrls.accessor_sign_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    });
    const responseBody = await response.text();
    logger.info({
      message: 'Accessor sign response',
      httpStatusCode: response.status,
    });
    logger.debug({
      message: 'Accessor sign response body',
      body: responseBody,
    });
    const signatureObj = JSON.parse(responseBody);
    const signature = signatureObj.signature;
    if (!verifySignature(signature, accessor_public_key, sid)) {
      throw new CustomError({
        errorType: errorType.INVALID_ACCESSOR_SIGNATURE,
      });
    }
    return signature;
  } catch (error) {
    throw new CustomError({
      errorType: errorType.SIGN_WITH_ACCESSOR_KEY_FAILED,
      cause: error,
      details: {
        callbackUrl: callbackUrls.accessor_sign_url,
        accessor_id,
        hash_id,
      },
    });
  }
}

// Used by API v1
function notifyByCallback({ url, type, eventDataForCallback }) {
  if (!url) {
    logger.error({
      message: `Callback URL for type: ${type} has not been set`,
    });
    return;
  }
  return callbackToClient(
    url,
    {
      type,
      ...eventDataForCallback,
    },
    true
  );
}

export function notifyIncomingRequestByCallback(nodeId, eventDataForCallback) {
  const url = callbackUrls.incoming_request_url;
  const type = 'incoming_request';
  if (!url) {
    logger.error({
      message: `Callback URL for type: ${type} has not been set`,
    });
    return;
  }
  return callbackToClient(
    url,
    {
      node_id: nodeId,
      type,
      ...eventDataForCallback,
    },
    true,
    'common.isRequestClosedOrTimedOut',
    [eventDataForCallback.request_id]
  );
}

/**
 * USE WITH API v1 ONLY
 * @param {Object} eventDataForCallback
 */
export function notifyCreateIdentityResultByCallback(eventDataForCallback) {
  notifyByCallback({
    url: callbackUrls.identity_result_url,
    type: 'create_identity_result',
    eventDataForCallback,
  });
}

/**
 * USE WITH API v1 ONLY
 * @param {Object} eventDataForCallback
 */
export function notifyAddAccessorResultByCallback(eventDataForCallback) {
  notifyByCallback({
    url: callbackUrls.identity_result_url,
    type: 'add_accessor_result',
    eventDataForCallback,
  });
}

function checkReceiverIntegrity(requestId, requestDetail, nodeId) {
  const filterIdpList = requestDetail.idp_id_list.filter((node_id) => {
    return node_id === nodeId;
  });
  if (filterIdpList.length === 0) {
    logger.warn({
      message: 'Request does not involve receiver node',
      requestId,
    });
    logger.debug({
      message: 'Request does not involve receiver node',
      requestId,
      idp_id_list: requestDetail.request_message,
      receiverNodeId: nodeId,
    });
    return false;
  }
  return true;
}

export async function processMessage(nodeId, message) {
  logger.debug({
    message: 'Processing message',
    nodeId,
    messagePayload: message,
  });
  if (message.type === privateMessageType.IDP_RESPONSE) {
    const requestDetail = await tendermintNdid.getRequestDetail({
      requestId: message.request_id,
    });

    if(requestDetail.purpose === 'AddAccessor') {
      //reponse for create identity
      if (await checkCreateIdentityResponse(nodeId, message, requestDetail)) {
        //TODO what if create identity request need more than 1 min_idp
        await identity.addAccessorAfterConsent(
          {
            nodeId,
            request_id: message.request_id,
            old_accessor_id: message.accessor_id,
          },
          {
            callbackFnName: 'idp.processIdpResponseAfterAddAccessor',
            callbackAdditionalArgs: [{ nodeId, message }],
          }
        );
      }
    }
    else if(requestDetail.purpose === 'RevokeAccessor') {
      //reponse for revoke identity
      const revoking_accessor_id = await cacheDb.getAccessorIdToRevokeFromRequestId(nodeId, message.request_id);

      if (await checkRevokeIdentityResponse(nodeId, message, requestDetail, revoking_accessor_id)) {
        //TODO what if revoke identity request need more than 1 min_idp
        await identity.revokeAccessorAfterConsent(
          {
            nodeId,
            request_id: message.request_id,
            old_accessor_id: message.accessor_id,
            revoking_accessor_id,
          },
          {
            callbackFnName: 'idp.processIdpResponseAfterRevokeAccessor',
            callbackAdditionalArgs: [{ nodeId, message }],
          }
        );
      }
    }

  } else if (message.type === privateMessageType.CHALLENGE_REQUEST) {
    //const responseId = message.request_id + ':' + message.idp_id;
    await common.handleChallengeRequest({
      nodeId,
      request_id: message.request_id,
      idp_id: message.idp_id,
      public_proof: message.public_proof,
    });
  } else if (message.type === privateMessageType.CONSENT_REQUEST) {
    const requestDetail = await tendermintNdid.getRequestDetail({
      requestId: message.request_id,
    });
    const messageValid = common.checkRequestMessageIntegrity(
      message.request_id,
      message,
      requestDetail
    );
    const receiverValid = checkReceiverIntegrity(
      message.request_id,
      requestDetail,
      nodeId
    );
    const valid = messageValid && receiverValid;
    if (!valid) {
      throw new CustomError({
        errorType: errorType.REQUEST_INTEGRITY_CHECK_FAILED,
        details: {
          requestId: message.request_id,
        },
      });
    }
    await cacheDb.setRequestMessage(nodeId, message.request_id, {
      request_message: message.request_message,
      request_message_salt: message.request_message_salt,
      initial_salt: message.initial_salt,
    });
    notifyIncomingRequestByCallback(nodeId, {
      mode: message.mode,
      request_id: message.request_id,
      namespace: message.namespace,
      identifier: message.identifier,
      request_message: message.request_message,
      request_message_hash: utils.hashRequestMessageForConsent(
        message.request_message,
        message.initial_salt,
        message.request_id
      ),
      request_message_salt: message.request_message_salt,
      requester_node_id: message.rp_id,
      min_ial: message.min_ial,
      min_aal: message.min_aal,
      data_request_list: message.data_request_list,
      initial_salt: message.initial_salt,
      creation_time: message.creation_time,
      creation_block_height: requestDetail.creation_block_height,
      request_timeout: message.request_timeout,
    });
  }
}

export async function processIdpResponseAfterAddAccessor(
  { error, secret, associated },
  { nodeId, message }
) {
  try {
    if (error) throw error;

    const reference_id = await cacheDb.getReferenceIdByRequestId(
      nodeId,
      message.request_id
    );
    const callbackUrl = await cacheDb.getCallbackUrlByReferenceId(
      nodeId,
      reference_id
    );
    const notifyData = {
      success: true,
      reference_id,
      request_id: message.request_id,
      secret,
    };
    if (associated) {
      if (callbackUrl == null) {
        // Implies API v1
        notifyAddAccessorResultByCallback(notifyData);
      } else {
        await callbackToClient(
          callbackUrl,
          {
            node_id: nodeId,
            type: 'add_accessor_result',
            ...notifyData,
          },
          true
        );
        cacheDb.removeCallbackUrlByReferenceId(nodeId, reference_id);
      }
    } else {
      if (callbackUrl == null) {
        // Implies API v1
        notifyCreateIdentityResultByCallback(notifyData);
      } else {
        await callbackToClient(
          callbackUrl,
          {
            node_id: nodeId,
            type: 'create_identity_result',
            ...notifyData,
          },
          true
        );
        cacheDb.removeCallbackUrlByReferenceId(nodeId, reference_id);
      }
    }
    cacheDb.removeReferenceIdByRequestId(nodeId, message.request_id);
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing IdP response for creating identity',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      nodeId,
      callbackUrl: callbackUrls.error_url,
      action: 'processIdpResponseAfterAddAccessor',
      error: err,
      requestId: message.request_id,
    });
  }
}

async function checkCreateIdentityResponse(nodeId, message, requestDetail) {
  try {
    const requestStatus = utils.getDetailedRequestStatus(requestDetail);

    const responseValid = await common.checkIdpResponse({
      nodeId,
      requestStatus,
      idpId: message.idp_id,
      requestDataFromMq: message,
      responseIal: requestDetail.response_list.find(
        (response) => response.idp_id === message.idp_id
      ).ial,
    });

    if (
      !responseValid.valid_signature ||
      !responseValid.valid_proof ||
      !responseValid.valid_ial
    ) {
      throw new CustomError({
        errorType: errorType.INVALID_RESPONSE,
      });
    }

    const response = requestDetail.response_list[0];

    if (response.status !== 'accept') {
      throw new CustomError({
        errorType: errorType.USER_REJECTED,
      });
    }

    logger.debug({
      message: 'Create identity consented',
    });
    await common.closeRequest(
      {
        node_id: nodeId,
        request_id: message.request_id,
      },
      { synchronous: true }
    );
    return true;
  } catch (error) {
    const { associated } = await cacheDb.getIdentityFromRequestId(
      nodeId,
      message.request_id
    );

    const reference_id = await cacheDb.getReferenceIdByRequestId(
      nodeId,
      message.request_id
    );
    const callbackUrl = await cacheDb.getCallbackUrlByReferenceId(
      nodeId,
      reference_id
    );
    if (associated) {
      if (callbackUrl == null) {
        // Implies API v1
        notifyAddAccessorResultByCallback({
          request_id: message.request_id,
          success: false,
          error: getErrorObjectForClient(error),
        });
      } else {
        await callbackToClient(
          callbackUrl,
          {
            node_id: nodeId,
            type: 'add_accessor_result',
            success: false,
            reference_id,
            request_id: message.request_id,
            error: getErrorObjectForClient(error),
          },
          true
        );
        cacheDb.removeCallbackUrlByReferenceId(nodeId, reference_id);
      }
    } else {
      if (callbackUrl == null) {
        // Implies API v1
        notifyCreateIdentityResultByCallback({
          request_id: message.request_id,
          success: false,
          error: getErrorObjectForClient(error),
        });
      } else {
        await callbackToClient(
          callbackUrl,
          {
            node_id: nodeId,
            type: 'create_identity_result',
            success: false,
            reference_id,
            request_id: message.request_id,
            error: getErrorObjectForClient(error),
          },
          true
        );
        cacheDb.removeCallbackUrlByReferenceId(nodeId, reference_id);
      }
    }
    cacheDb.removeCreateIdentityDataByReferenceId(nodeId, reference_id);
    await common.closeRequest(
      {
        node_id: nodeId,
        request_id: message.request_id,
      },
      { synchronous: true }
    );

    logger.debug({
      message: 'Create identity failed',
      error,
    });
    return false;
  }
}

export async function processIdpResponseAfterRevokeAccessor(
  { error },
  { nodeId, message }
) {
  try {
    if (error) throw error;

    const reference_id = await cacheDb.getReferenceIdByRequestId(
      nodeId,
      message.request_id
    );
    const callbackUrl = await cacheDb.getCallbackUrlByReferenceId(
      nodeId,
      reference_id
    );
    const notifyData = {
      success: true,
      reference_id,
      request_id: message.request_id,
    };
    await callbackToClient(
      callbackUrl,
      {
        node_id: nodeId,
        type: 'revoke_accessor_result',
        ...notifyData,
      },
      true
    );
    cacheDb.removeCallbackUrlByReferenceId(nodeId, reference_id);
    cacheDb.removeReferenceIdByRequestId(nodeId, message.request_id);
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing IdP response for revoke identity',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      nodeId,
      callbackUrl: callbackUrls.error_url,
      action: 'processIdpResponseAfterRevokeAccessor',
      error: err,
      requestId: message.request_id,
    });
  }
}

async function checkRevokeIdentityResponse(nodeId, message, requestDetail, revoking_accessor_id) {
  try {
    const requestStatus = utils.getDetailedRequestStatus(requestDetail);

    const responseValid = await common.checkIdpResponse({
      nodeId,
      requestStatus,
      idpId: message.idp_id,
      requestDataFromMq: message,
      responseIal: requestDetail.response_list.find(
        (response) => response.idp_id === message.idp_id
      ).ial,
    });

    //accessor_group_id must be same as group revoking accessor_id
    const revoking_group = await tendermintNdid.getAccessorGroupId(revoking_accessor_id);
    const responding_group = await tendermintNdid.getAccessorGroupId(message.accessor_id);

    logger.debug({
      message: 'Check response for revoke accessor',
      revoking_accessor_id,
      responding_accessor_id: message.accessor_id,
      revoking_group,
      responding_group,
    });

    if(revoking_group !== responding_group) {
      throw new CustomError({
        errorType: errorType.INVALID_ACCESSOR_RESPONSE,
      });
    }

    if (
      !responseValid.valid_signature ||
      !responseValid.valid_proof ||
      !responseValid.valid_ial
    ) {
      throw new CustomError({
        errorType: errorType.INVALID_RESPONSE,
      });
    }

    const response = requestDetail.response_list[0];

    if (response.status !== 'accept') {
      throw new CustomError({
        errorType: errorType.USER_REJECTED,
      });
    }

    logger.debug({
      message: 'Revoke identity consented',
    });
    await common.closeRequest(
      {
        node_id: nodeId,
        request_id: message.request_id,
      },
      { synchronous: true }
    );
    return true;
  } catch (error) {
    const reference_id = await cacheDb.getReferenceIdByRequestId(
      nodeId,
      message.request_id
    );
    const callbackUrl = await cacheDb.getCallbackUrlByReferenceId(
      nodeId,
      reference_id
    );
    
    await callbackToClient(
      callbackUrl,
      {
        node_id: nodeId,
        type: 'revoke_accessor_result',
        success: false,
        reference_id,
        request_id: message.request_id,
        error: getErrorObjectForClient(error),
      },
      true
    );
    cacheDb.removeCallbackUrlByReferenceId(nodeId, reference_id);
    cacheDb.removeCreateIdentityDataByReferenceId(nodeId, reference_id);
    await common.closeRequest(
      {
        node_id: nodeId,
        request_id: message.request_id,
      },
      { synchronous: true }
    );

    logger.debug({
      message: 'Revoke identity failed',
      error,
    });
    return false;
  }
}