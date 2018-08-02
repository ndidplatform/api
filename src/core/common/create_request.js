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

import {
  getIdpsMsqDestination,
  addTimeoutScheduler,
  removeTimeoutScheduler,
  getFunction,
} from '.';

import CustomError from '../../error/custom_error';
import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as mq from '../../mq';
import { callbackToClient } from '../../utils/callback';
import * as utils from '../../utils';
import * as config from '../../config';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../private_message_type';

/**
 * Create a new request
 * @param {Object} createRequestParams
 * @param {number} createRequestParams.mode
 * @param {string} createRequestParams.namespace
 * @param {string} createRequestParams.reference_id
 * @param {Array.<string>} createRequestParams.idp_id_list
 * @param {string} createRequestParams.callback_url
 * @param {Array.<Object>} createRequestParams.data_request_list
 * @param {string} createRequestParams.request_message
 * @param {number} createRequestParams.min_ial
 * @param {number} createRequestParams.min_aal
 * @param {number} createRequestParams.min_idp
 * @param {number} createRequestParams.request_timeout
 * @param {Object} options
 * @param {boolean} options.synchronous
 * @param {boolean} options.sendCallbackToClient
 * @param {string} options.callbackFnName
 * @param {Array} options.callbackAdditionalArgs
 * @param {Object} additionalParams
 * @param {string} additionalParams.request_id
 * @returns {Promise<Object>} Request ID and request message salt
 */
export async function createRequest(
  createRequestParams,
  options = {},
  additionalParams = {}
) {
  const {
    mode,
    namespace,
    identifier,
    reference_id,
    idp_id_list,
    callback_url,
    data_request_list,
    request_message,
    min_ial,
    min_aal,
    min_idp,
    request_timeout,
  } = createRequestParams;
  const { synchronous = false } = options;
  let {
    request_id, // Pre-generated request ID. Used by create identity function.
  } = additionalParams;
  try {
    // existing reference_id, return request ID
    const requestId = await cacheDb.getRequestIdByReferenceId(reference_id);
    if (requestId) {
      return requestId;
    }

    if (
      idp_id_list != null &&
      idp_id_list.length > 0 &&
      idp_id_list.length < min_idp
    ) {
      throw new CustomError({
        message: errorType.IDP_LIST_LESS_THAN_MIN_IDP.message,
        code: errorType.IDP_LIST_LESS_THAN_MIN_IDP.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
          min_idp,
        },
      });
    }

    if (mode === 1 && (idp_id_list == null || idp_id_list.length === 0)) {
      throw new CustomError({
        message: errorType.IDP_ID_LIST_NEEDED.message,
        code: errorType.IDP_ID_LIST_NEEDED.code,
        clientError: true,
      });
    }

    if (data_request_list != null && data_request_list.length > 0) {
      const serviceIds = [];
      for (let i = 0; i < data_request_list.length; i++) {
        const { service_id, as_id_list, min_as } = data_request_list[i];

        if (serviceIds.includes(service_id)) {
          throw new CustomError({
            message: errorType.DUPLICATE_SERVICE_ID.message,
            code: errorType.DUPLICATE_SERVICE_ID.code,
            clientError: true,
            details: {
              index: i,
              service_id,
            },
          });
        }
        serviceIds.push(service_id);

        //all as_list offer the service
        let potential_as_list = await tendermintNdid.getAsNodesByServiceId({
          service_id,
        });
        if (as_id_list != null && as_id_list.length > 0) {
          if (as_id_list.length < min_as) {
            throw new CustomError({
              message: errorType.AS_LIST_LESS_THAN_MIN_AS.message,
              code: errorType.AS_LIST_LESS_THAN_MIN_AS.code,
              clientError: true,
              details: {
                service_id,
                as_id_list,
                min_as,
              },
            });
          }

          if (potential_as_list.length < min_as) {
            throw new CustomError({
              message: errorType.NOT_ENOUGH_AS.message,
              code: errorType.NOT_ENOUGH_AS.code,
              clientError: true,
              details: {
                service_id,
                potential_as_list,
                min_as,
              },
            });
          }

          //filter potential AS to be only in as_id_list
          potential_as_list = potential_as_list.filter((as_node) => {
            return as_id_list.indexOf(as_node.node_id) !== -1;
          });

          if (potential_as_list.length !== as_id_list.length) {
            throw new CustomError({
              message: errorType.SOME_AS_DO_NOT_PROVIDE_SERVICE.message,
              code: errorType.SOME_AS_DO_NOT_PROVIDE_SERVICE.code,
              clientError: true,
            });
          }
        }
        //filter min_ial, min_aal
        potential_as_list = potential_as_list.filter((as_node) => {
          return as_node.min_ial <= min_ial && as_node.min_aal <= min_aal;
        });

        if (potential_as_list.length < min_as) {
          throw new CustomError({
            message: errorType.CONDITION_TOO_LOW.message,
            code: errorType.CONDITION_TOO_LOW.code,
            clientError: true,
            details: {
              service_id,
              min_ial,
              min_aal,
              min_as,
            },
          });
        }
      }
    }

    let receivers = await getIdpsMsqDestination({
      namespace,
      identifier,
      min_ial,
      min_aal,
      idp_id_list,
      mode,
    });

    if (receivers.length === 0 && min_idp !== 0) {
      throw new CustomError({
        message: errorType.NO_IDP_FOUND.message,
        code: errorType.NO_IDP_FOUND.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
        },
      });
    }

    if (receivers.length < min_idp) {
      throw new CustomError({
        message: errorType.NOT_ENOUGH_IDP.message,
        code: errorType.NOT_ENOUGH_IDP.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
        },
      });
    }

    if (request_id == null) {
      request_id = utils.createRequestId();
    }

    // const challenge = [
    //   utils.randomBase64Bytes(config.challengeLength),
    //   utils.randomBase64Bytes(config.challengeLength),
    // ];
    await cacheDb.setChallengeFromRequestId(request_id, {});

    const request_message_salt = utils.randomBase64Bytes(config.saltLength);

    const data_request_params_salt_list = data_request_list.map(
      (data_request) => {
        const { service_id } = data_request;
        return utils.generateRequestParamSalt({
          request_id,
          service_id,
          request_message_salt,
        });
      }
    );

    const requestData = {
      mode,
      namespace,
      identifier,
      request_id,
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list,
      data_request_params_salt_list,
      request_message,
      // for zk proof
      //challenge,
      rp_id: config.nodeId,
      request_message_salt,
    };

    // save request data to DB to send to AS via mq when authen complete
    // and for zk proof
    await Promise.all([
      cacheDb.setRequestData(request_id, requestData),
      cacheDb.setRequestIdByReferenceId(reference_id, request_id),
      cacheDb.setRequestCallbackUrl(request_id, callback_url),
      addTimeoutScheduler(request_id, request_timeout),
    ]);

    if (synchronous) {
      await createRequestInternalAsync(createRequestParams, options, {
        request_id,
        request_message_salt,
        data_request_params_salt_list,
        receivers,
        requestData,
      });
    } else {
      createRequestInternalAsync(createRequestParams, options, {
        request_id,
        request_message_salt,
        data_request_params_salt_list,
        receivers,
        requestData,
      });
    }

    return { request_id, request_message_salt };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create request',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function createRequestInternalAsync(
  createRequestParams,
  options = {},
  additionalParams
) {
  const {
    mode,
    reference_id,
    callback_url,
    data_request_list,
    request_message,
    min_ial,
    min_aal,
    min_idp,
    request_timeout,
  } = createRequestParams;
  const {
    synchronous = false,
    sendCallbackToClient = true,
    callbackFnName,
    callbackAdditionalArgs,
  } = options;
  const {
    request_id,
    request_message_salt,
    data_request_params_salt_list,
    receivers,
    requestData,
  } = additionalParams;
  try {
    const dataRequestListToBlockchain = data_request_list.map(
      (dataRequest, index) => {
        return {
          service_id: dataRequest.service_id,
          as_id_list: dataRequest.as_id_list,
          min_as: dataRequest.min_as,
          request_params_hash: utils.hash(
            dataRequest.request_params + data_request_params_salt_list[index]
          ),
        };
      }
    );

    const requestDataToBlockchain = {
      mode,
      request_id,
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list: dataRequestListToBlockchain,
      request_message_hash: utils.hash(request_message + request_message_salt),
    };

    if (!synchronous) {
      await tendermintNdid.createRequest(
        requestDataToBlockchain,
        'common.createRequestInternalAsyncAfterBlockchain',
        [
          {
            reference_id,
            callback_url,
            request_id,
            min_idp,
            receivers,
            requestData,
          },
          {
            synchronous,
            sendCallbackToClient,
            callbackFnName,
            callbackAdditionalArgs,
          },
        ]
      );
    } else {
      const { height } = await tendermintNdid.createRequest(
        requestDataToBlockchain
      );
      await createRequestInternalAsyncAfterBlockchain(
        { height },
        {
          reference_id,
          callback_url,
          request_id,
          min_idp,
          receivers,
          requestData,
        },
        {
          synchronous,
          sendCallbackToClient,
          callbackFnName,
          callbackAdditionalArgs,
        }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Create request internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient(
          callback_url,
          {
            type: 'create_request_result',
            success: false,
            reference_id,
            request_id,
            error: getErrorObjectForClient(error),
          },
          true
        );
      }
      if (callbackFnName != null) {
        if (callbackAdditionalArgs != null) {
          getFunction(callbackFnName)({ error }, ...callbackAdditionalArgs);
        } else {
          getFunction(callbackFnName)({ error });
        }
      }
    }

    await createRequestCleanUpOnError({
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function createRequestInternalAsyncAfterBlockchain(
  { height, error },
  { reference_id, callback_url, request_id, min_idp, receivers, requestData },
  {
    synchronous = false,
    sendCallbackToClient = true,
    callbackFnName,
    callbackAdditionalArgs,
  } = {}
) {
  try {
    if (error) throw error;
    // send request data to IDPs via message queue
    if (min_idp > 0) {
      mq.send(receivers, {
        type: privateMessageType.CONSENT_REQUEST,
        ...requestData,
        height,
      });
    }

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient(
          callback_url,
          {
            type: 'create_request_result',
            success: true,
            reference_id,
            request_id,
          },
          true
        );
      }
      if (callbackFnName != null) {
        if (callbackAdditionalArgs != null) {
          getFunction(callbackFnName)({ height }, ...callbackAdditionalArgs);
        } else {
          getFunction(callbackFnName)({ height });
        }
      }
    }
  } catch (error) {
    logger.error({
      message: 'Create request internal async after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      error,
    });

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient(
          callback_url,
          {
            type: 'create_request_result',
            success: false,
            reference_id,
            request_id,
            error: getErrorObjectForClient(error),
          },
          true
        );
      }
      if (callbackFnName != null) {
        if (callbackAdditionalArgs != null) {
          getFunction(callbackFnName)({ error }, ...callbackAdditionalArgs);
        } else {
          getFunction(callbackFnName)({ error });
        }
      }

      await createRequestCleanUpOnError({
        requestId: request_id,
        referenceId: reference_id,
      });
    } else {
      throw error;
    }
  }
}

async function createRequestCleanUpOnError({ requestId, referenceId }) {
  await Promise.all([
    cacheDb.removeChallengeFromRequestId(requestId),
    cacheDb.removeRequestData(requestId),
    cacheDb.removeRequestIdByReferenceId(referenceId),
    cacheDb.removeRequestCallbackUrl(requestId),
    removeTimeoutScheduler(requestId),
  ]);
}
