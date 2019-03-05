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

import { getFunction } from '../../functions';
import {
  getIdpsMsqDestination,
  setTimeoutScheduler,
  removeTimeoutScheduler,
} from '.';

import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import * as mq from '../../mq';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../../mq/message/type';
import * as utils from '../../utils';
import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';

import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

async function checkIdpListCondition({
  namespace,
  identifier,
  min_ial,
  min_aal,
  min_idp,
  idp_id_list,
  mode,
}) {
  if (idp_id_list.length !== 0 && idp_id_list.length < min_idp) {
    throw new CustomError({
      errorType: errorType.IDP_LIST_LESS_THAN_MIN_IDP,
      details: {
        namespace,
        identifier,
        idp_id_list,
        min_idp,
      },
    });
  }

  if (mode === 1 && idp_id_list.length === 0) {
    throw new CustomError({
      errorType: errorType.IDP_ID_LIST_NEEDED,
    });
  }

  const receivers = await getIdpsMsqDestination({
    namespace,
    identifier,
    min_ial,
    min_aal,
    idp_id_list,
    mode,
  });

  if (min_idp !== 0) {
    if (receivers.length === 0) {
      throw new CustomError({
        errorType: errorType.NO_IDP_FOUND,
        details: {
          namespace,
          identifier,
          idp_id_list,
          min_ial,
          min_aal,
          mode,
        },
      });
    }

    if (idp_id_list.length !== 0 && receivers.length < idp_id_list.length) {
      throw new CustomError({
        errorType: errorType.UNQUALIFIED_IDP,
        details: {
          namespace,
          identifier,
          idp_id_list,
          min_ial,
          min_aal,
          mode,
        },
      });
    }

    if (receivers.length < min_idp) {
      throw new CustomError({
        errorType: errorType.NOT_ENOUGH_IDP,
        details: {
          namespace,
          identifier,
          idp_id_list,
          min_ial,
          min_aal,
          mode,
        },
      });
    }
  }
  return receivers;
}

async function checkAsListCondition({ data_request_list, min_ial, min_aal }) {
  const serviceIds = data_request_list.map(
    (dataRequest) => dataRequest.service_id
  );

  const serviceIdsNoDuplicate = [...new Set(serviceIds)];

  if (serviceIds.length !== serviceIdsNoDuplicate.length) {
    throw new CustomError({
      errorType: errorType.DUPLICATE_SERVICE_ID,
      details: {
        data_request_list,
      },
    });
  }

  await Promise.all(
    data_request_list.map(async (dataRequest) => {
      const { service_id, min_as } = dataRequest;
      let { as_id_list } = dataRequest;
      if (as_id_list != null && as_id_list.length === 0) as_id_list = null;

      //all as_list offer the service
      let potential_as_list = await tendermintNdid.getAsNodesInfoByServiceId({
        service_id,
        node_id_list: as_id_list,
      });
      if (as_id_list != null) {
        if (as_id_list.length < min_as) {
          throw new CustomError({
            errorType: errorType.AS_LIST_LESS_THAN_MIN_AS,
            details: {
              service_id,
              as_id_list,
              min_as,
            },
          });
        }

        if (potential_as_list.length < min_as) {
          throw new CustomError({
            errorType: errorType.NOT_ENOUGH_AS,
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
            errorType: errorType.SOME_AS_DO_NOT_PROVIDE_SERVICE,
          });
        }
      }
      //filter min_ial, min_aal
      potential_as_list = potential_as_list.filter((as_node) => {
        return as_node.min_ial <= min_ial && as_node.min_aal <= min_aal;
      });

      if (potential_as_list.length < min_as) {
        throw new CustomError({
          errorType: errorType.CONDITION_TOO_LOW,
          details: {
            service_id,
            min_ial,
            min_aal,
            min_as,
          },
        });
      }

      if (
        as_id_list != null &&
        potential_as_list.length !== as_id_list.length
      ) {
        throw new CustomError({
          errorType: errorType.UNQUALIFIED_AS,
          details: {
            service_id,
            min_ial,
            min_aal,
            min_as,
          },
        });
      }

      if (as_id_list == null) {
        dataRequest.as_id_list = potential_as_list.map(
          (node_info) => node_info.node_id
        );
      }
    })
  );
}

/**
 * Create a new request
 *
 * @param {Object} createRequestParams
 * @param {string} createRequestParams.node_id
 * @param {number} createRequestParams.mode
 * @param {string} createRequestParams.namespace
 * @param {string} createRequestParams.identifier
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
 * @param {boolean} [options.synchronous]
 * @param {boolean} [options.sendCallbackToClient]
 * @param {string} [options.callbackFnName]
 * @param {Array} [options.callbackAdditionalArgs]
 * @param {boolean} [options.saveForRetryOnChainDisabled]
 * @param {Object} additionalParams
 * @param {string} [additionalParams.request_id]
 *
 * @returns {Promise<Object>} Request ID and request message salt
 */
export async function createRequest(
  createRequestParams,
  options = {},
  additionalParams = {}
) {
  if (createRequestParams.idp_id_list == null) {
    createRequestParams.idp_id_list = [];
  }
  let { node_id } = createRequestParams;
  const {
    mode,
    namespace,
    identifier,
    reference_id,
    idp_id_list,
    callback_url,
    data_request_list = [],
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
    const requestId = await cacheDb.getRequestIdByReferenceId(
      node_id,
      reference_id
    );
    if (requestId) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_REFERENCE_ID,
      });
    }

    const receivers = await checkIdpListCondition({
      namespace,
      identifier,
      min_ial,
      min_aal,
      min_idp,
      idp_id_list,
      mode,
    });

    if (data_request_list != null && data_request_list.length > 0) {
      await checkAsListCondition({
        data_request_list,
        min_ial,
        min_aal,
      });
    }

    if (idp_id_list.length === 0) {
      receivers.forEach(({ node_id }) => {
        idp_id_list.push(node_id);
      });
    }

    if (request_id == null) {
      request_id = utils.createRequestId();
    }

    const challenge = {};
    const generatedChallenges = utils.generatedChallenges(receivers.length);
    receivers.forEach(({ node_id }, index) => {
      challenge[node_id] = generatedChallenges[index];
    });

    const initial_salt = utils.randomBase64Bytes(config.saltLength);
    const request_message_salt = utils.generateRequestMessageSalt(initial_salt);

    const data_request_params_salt_list = data_request_list.map(
      (data_request) => {
        const { service_id } = data_request;
        return utils.generateRequestParamSalt({
          request_id,
          service_id,
          initial_salt,
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
      challenge,
      rp_id: node_id,
      request_message_salt,
      initial_salt,
      reference_id,
      callback_url,
    };

    // save request data to DB to send to AS via mq when authen complete
    // and for zk proof
    await Promise.all([
      cacheDb.setRequestData(node_id, request_id, requestData),
      cacheDb.setRequestIdByReferenceId(node_id, reference_id, request_id),
    ]);

    if (synchronous) {
      await createRequestInternalAsync(createRequestParams, options, {
        node_id,
        request_id,
        request_message_salt,
        data_request_params_salt_list,
        receivers,
        requestData,
      });
    } else {
      createRequestInternalAsync(createRequestParams, options, {
        node_id,
        request_id,
        request_message_salt,
        data_request_params_salt_list,
        receivers,
        requestData,
      });
    }

    return { request_id, initial_salt };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create request',
      cause: error,
    });
    logger.error({ err });

    if (
      !(
        error.name === 'CustomError' &&
        error.code === errorType.DUPLICATE_REFERENCE_ID.code
      )
    ) {
      await createRequestCleanUpOnError({
        nodeId: node_id,
        requestId: request_id,
        referenceId: reference_id,
      });
    }

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
    data_request_list = [],
    request_message,
    min_ial,
    min_aal,
    min_idp,
    request_timeout,
    idp_id_list,
    purpose,
  } = createRequestParams;
  const {
    synchronous = false,
    sendCallbackToClient = true,
    callbackFnName,
    callbackAdditionalArgs,
    saveForRetryOnChainDisabled,
  } = options;
  const {
    node_id,
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
            dataRequest.request_params != null
              ? dataRequest.request_params
              : '' + data_request_params_salt_list[index]
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
      idp_id_list,
      purpose,
    };

    if (!synchronous) {
      await tendermintNdid.createRequest(
        requestDataToBlockchain,
        node_id,
        'common.createRequestInternalAsyncAfterBlockchain',
        [
          {
            node_id,
            reference_id,
            callback_url,
            request_id,
            min_idp,
            request_timeout,
            receivers,
            requestData,
          },
          {
            synchronous,
            sendCallbackToClient,
            callbackFnName,
            callbackAdditionalArgs,
          },
        ],
        saveForRetryOnChainDisabled
      );
    } else {
      const { height } = await tendermintNdid.createRequest(
        requestDataToBlockchain,
        node_id
      );
      await createRequestInternalAsyncAfterBlockchain(
        { height },
        {
          node_id,
          reference_id,
          callback_url,
          request_id,
          min_idp,
          request_timeout,
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
      err: error,
    });

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient(
          callback_url,
          {
            node_id,
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
      nodeId: node_id,
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function createRequestInternalAsyncAfterBlockchain(
  { height, error, chainDisabledRetryLater },
  {
    node_id,
    reference_id,
    callback_url,
    request_id,
    min_idp,
    request_timeout,
    receivers,
    requestData,
  },
  {
    synchronous = false,
    sendCallbackToClient = true,
    callbackFnName,
    callbackAdditionalArgs,
  } = {}
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    const creation_time = Date.now();

    await cacheDb.setRequestCreationMetadata(node_id, request_id, {
      creation_time,
    });

    await setTimeoutScheduler(node_id, request_id, request_timeout);

    const {
      min_idp: _1, // eslint-disable-line no-unused-vars
      challenge: _2, // eslint-disable-line no-unused-vars
      reference_id: _3, // eslint-disable-line no-unused-vars
      callback_url: _4, // eslint-disable-line no-unused-vars
      ...requestDataWithoutLocalSpecificProps
    } = requestData;
    const requestDataWithoutDataRequestParams = {
      ...requestDataWithoutLocalSpecificProps,
      data_request_list: requestData.data_request_list.map((dataRequest) => {
        const { request_params, ...dataRequestWithoutParams } = dataRequest; // eslint-disable-line no-unused-vars
        return {
          ...dataRequestWithoutParams,
        };
      }),
    };

    // send request data to IDPs via message queue
    if (min_idp > 0) {
      await mq.send(
        receivers,
        {
          type: privateMessageType.CONSENT_REQUEST,
          ...requestDataWithoutDataRequestParams,
          creation_time,
          chain_id: tendermint.chainId,
          height,
        },
        node_id
      );
    }

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient(
          callback_url,
          {
            node_id,
            type: 'create_request_result',
            success: true,
            reference_id,
            request_id,
            creation_block_height: `${tendermint.chainId}:${height}`,
          },
          true
        );
      }
      if (callbackFnName != null) {
        if (callbackAdditionalArgs != null) {
          getFunction(callbackFnName)(
            { chainId: tendermint.chainId, height },
            ...callbackAdditionalArgs
          );
        } else {
          getFunction(callbackFnName)({ chainId: tendermint.chainId, height });
        }
      }
    }
  } catch (error) {
    logger.error({
      message: 'Create request internal async after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      err: error,
    });

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient(
          callback_url,
          {
            node_id,
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
        nodeId: node_id,
        requestId: request_id,
        referenceId: reference_id,
      });
      await removeTimeoutScheduler(node_id, request_id);
    } else {
      throw error;
    }
  }
}

async function createRequestCleanUpOnError({ nodeId, requestId, referenceId }) {
  await Promise.all([
    cacheDb.removeRequestData(nodeId, requestId),
    cacheDb.removePrivateProofObjectListInRequest(nodeId, requestId),
    cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
    cacheDb.removeRequestCreationMetadata(nodeId, requestId),
  ]);
}
