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
import * as db from '../../db';
import * as identity from '../identity';

export * from './create_response';
export * from './event_handlers';

export const callbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  config.dataDirectoryPath,
  'idp-callback-url-' + config.nodeId
);

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
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn({
        message: `${fileSuffix} callback url file not found`,
      });
    } else {
      logger.error({
        message: `Cannot read ${fileSuffix} callback url file`,
        error,
      });
    }
  }
});

function writeCallbackUrlToFile(fileSuffix, url) {
  fs.writeFile(callbackUrlFilesPrefix + '-' + fileSuffix, url, (err) => {
    if (err) {
      logger.error({
        message: `Cannot write ${fileSuffix} callback url file`,
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
  };

  if (callbackUrls.accessor_sign_url == null) {
    throw new CustomError({
      message: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET.message,
      code: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET.code,
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
        message: errorType.INVALID_ACCESSOR_SIGNATURE.message,
        code: errorType.INVALID_ACCESSOR_SIGNATURE.code,
        clientError: true,
      });
    }
    return signature;
  } catch (error) {
    throw new CustomError({
      message: errorType.SIGN_WITH_ACCESSOR_KEY_FAILED.message,
      code: errorType.SIGN_WITH_ACCESSOR_KEY_FAILED.code,
      cause: error,
      details: {
        callbackUrl: callbackUrls.accessor_sign_url,
        accessor_id,
        hash_id,
      },
    });
  }
}

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

export function notifyIncomingRequestByCallback(eventDataForCallback) {
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

export async function processMessage(message) {
  logger.debug({
    message: 'Processing message',
    messagePayload: message,
  });
  if (message.type === 'idp_response') {
    //reponse for create identity
    if (await checkCreateIdentityResponse(message)) {
      await identity.addAccessorAfterConsent(
        {
          request_id: message.request_id,
          old_accessor_id: message.accessor_id,
        },
        {
          callbackFnName: 'idp.processIdpResponseAfterAddAccessor',
          callbackAdditionalArgs: [{ message }],
        }
      );
    }
  } else if (message.type === 'challenge_request') {
    //const responseId = message.request_id + ':' + message.idp_id;
    await common.handleChallengeRequest({
      request_id: message.request_id,
      idp_id: message.idp_id,
      public_proof: message.public_proof,
    });
  } else if (message.type === 'consent_request') {
    const valid = await common.checkRequestIntegrity(
      message.request_id,
      message
    );
    if (!valid) {
      throw new CustomError({
        message: errorType.REQUEST_INTEGRITY_CHECK_FAILED.message,
        code: errorType.REQUEST_INTEGRITY_CHECK_FAILED.code,
        details: {
          requestId: message.request_id,
        },
      });
    }
    await db.setRequestMessage(message.request_id, {
      request_message: message.request_message,
      request_message_salt: message.request_message_salt,
    });
    notifyIncomingRequestByCallback({
      mode: message.mode,
      request_id: message.request_id,
      namespace: message.namespace,
      identifier: message.identifier,
      request_message: message.request_message,
      request_message_hash: utils.hash(
        message.request_message
      ),
      // request_message_salt: message.request_message_salt,
      requester_node_id: message.rp_id,
      min_ial: message.min_ial,
      min_aal: message.min_aal,
      data_request_list: message.data_request_list,
    });
  }
}

export async function processIdpResponseAfterAddAccessor(
  { error, secret, associated },
  { message }
) {
  try {
    if (error) throw error;

    const reference_id = await db.getReferenceIdByRequestId(message.request_id);
    const callbackUrl = await db.getCallbackUrlByReferenceId(reference_id);
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
            type: 'add_accessor_result',
            ...notifyData,
          },
          true
        );
        db.removeCallbackUrlByReferenceId(reference_id);
      }
    } else {
      if (callbackUrl == null) {
        // Implies API v1
        notifyCreateIdentityResultByCallback(notifyData);
      } else {
        await callbackToClient(
          callbackUrl,
          {
            type: 'create_identity_result',
            ...notifyData,
          },
          true
        );
        db.removeCallbackUrlByReferenceId(reference_id);
      }
    }
    db.removeReferenceIdByRequestId(message.request_id);
    await common.closeRequest(
      {
        request_id: message.request_id,
      },
      { synchronous: true }
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing IdP response for creating identity',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      callbackUrl: callbackUrls.error_url,
      action: 'processIdpResponseAfterAddAccessor',
      error: err,
      requestId: message.request_id,
    });
  }
}

async function checkCreateIdentityResponse(message) {
  try {
    const requestDetail = await tendermintNdid.getRequestDetail({
      requestId: message.request_id,
    });
    const requestStatus = utils.getDetailedRequestStatus(requestDetail);

    const responseValid = await common.checkIdpResponse({
      requestStatus,
      idpId: message.idp_id,
      requestDataFromMq: message,
      responseIal: requestDetail.response_list.find(
        (response) => response.idp_id === message.idp_id
      ).ial,
    });

    if (!responseValid.valid_proof || !responseValid.valid_ial) {
      throw new CustomError({
        message: errorType.INVALID_RESPONSE.message,
        code: errorType.INVALID_RESPONSE.code,
      });
    }

    const response = requestDetail.response_list[0];

    if (response.status !== 'accept') {
      throw new CustomError({
        message: errorType.USER_REJECTED.message,
        code: errorType.USER_REJECTED.code,
      });
    }

    logger.debug({
      message: 'Create identity consented',
    });
    return true;
  } catch (error) {
    const { associated } = await db.getIdentityFromRequestId(
      message.request_id
    );

    const reference_id = await db.getReferenceIdByRequestId(message.request_id);
    const callbackUrl = await db.getCallbackUrlByReferenceId(reference_id);
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
            type: 'add_accessor_result',
            success: false,
            reference_id,
            request_id: message.request_id,
            error: getErrorObjectForClient(error),
          },
          true
        );
        db.removeCallbackUrlByReferenceId(reference_id);
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
            type: 'create_identity_result',
            success: false,
            reference_id,
            request_id: message.request_id,
            error: getErrorObjectForClient(error),
          },
          true
        );
        db.removeCallbackUrlByReferenceId(reference_id);
      }
    }
    db.removeCreateIdentityDataByReferenceId(reference_id);
    await common.closeRequest(
      {
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
