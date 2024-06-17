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

import { validateIdentifier } from './thai_citizen_id';

import { getFunction } from '../../functions';
import {
  getIdpMQDestinations,
  setTimeoutScheduler,
  removeTimeoutScheduler,
} from '.';

import parseDataURL from 'data-urls';

import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import * as nodeCallback from '../node_callback';
import * as mq from '../../mq';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../../mq/message/type';
import * as utils from '../../utils';
import * as cryptoUtils from '../../utils/crypto';
import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import { dataUrlRegex } from '../../data_url';

import TelemetryLogger, { REQUEST_EVENTS } from '../../telemetry';
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
  supported_request_message_data_url_type_list,
  bypass_identity_check,
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

  if ((mode === 1 || bypass_identity_check) && idp_id_list.length === 0) {
    throw new CustomError({
      errorType: errorType.IDP_ID_LIST_NEEDED,
    });
  }

  const receivers = await getIdpMQDestinations({
    namespace: bypass_identity_check ? undefined : namespace,
    identifier: bypass_identity_check ? undefined : identifier,
    min_ial: bypass_identity_check ? undefined : min_ial,
    min_aal,
    idp_id_list,
    //bypass for on-the-fly onboard (not filter mode)
    mode: bypass_identity_check ? undefined : mode,
    supported_request_message_data_url_type_list,
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
          supported_request_message_data_url_type_list,
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
          supported_request_message_data_url_type_list,
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
          supported_request_message_data_url_type_list,
        },
      });
    }
  }

  let receiversWithSid, receiversWithRefGroupCode;
  if (mode === 1) {
    receiversWithSid = receivers;
    receiversWithRefGroupCode = [];
  } else if (mode === 2 || mode === 3) {
    if (bypass_identity_check) {
      receiversWithRefGroupCode = await getIdpMQDestinations({
        namespace,
        identifier,
        // bypass min_ial for on-the-fly uplift
        // min_ial: 1.1,
        min_aal,
        idp_id_list,
        mode: 2, // get all IdPs supporting both only mode 2 and 2,3
        supported_request_message_data_url_type_list,
      });
      receiversWithSid = receivers.filter(
        ({ node_id }) =>
          receiversWithRefGroupCode.find(
            ({ node_id: nodeWithRefGroupCodeNodeId }) =>
              node_id === nodeWithRefGroupCodeNodeId
          ) == null
      );
    } else {
      receiversWithSid = [];
      receiversWithRefGroupCode = receivers;
    }
  }

  return {
    receivers,
    receiversWithSid,
    receiversWithRefGroupCode,
  };
}

async function checkAsListCondition({
  data_request_list,
  namespace,
  min_ial,
  min_aal,
}) {
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
      const { service_id } = dataRequest;
      let { as_id_list, min_as } = dataRequest;
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
          return as_id_list.includes(as_node.node_id);
        });

        if (potential_as_list.length !== as_id_list.length) {
          throw new CustomError({
            errorType: errorType.SOME_AS_DO_NOT_PROVIDE_SERVICE,
          });
        }
      }

      // filter out ASes that don't support required namespace
      potential_as_list = potential_as_list.filter((as_node) => {
        return as_node.supported_namespace_list.includes(namespace);
      });

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

      if (as_id_list != null) {
        if (potential_as_list.length !== as_id_list.length) {
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
      } else {
        if (potential_as_list.length === 0) {
          throw new CustomError({
            errorType: errorType.NOT_ENOUGH_AS,
            details: {
              service_id,
            },
          });
        }

        dataRequest.as_id_list = potential_as_list.map(
          (node_info) => node_info.node_id
        );
      }
    })
  );
}

async function checkWhitelistCondition({ node_id, idp_id_list }) {
  const rp_data = await tendermintNdid.getNodeInfo(node_id);
  if (rp_data == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: { node_id },
    });
  }

  const { node_id_whitelist_active: active, node_id_whitelist: whitelist } =
    rp_data;

  if (active && idp_id_list.length == 0) {
    idp_id_list.push(...whitelist);
  }

  await Promise.all(
    idp_id_list.map(async (idpNodeId) => {
      if (
        active &&
        (whitelist == null || whitelist.indexOf(idpNodeId) === -1)
      ) {
        throw new CustomError({
          errorType: errorType.NOT_IN_WHITELIST,
          details: {
            node_id: node_id,
            whitelist: whitelist,
            request_node_id: idpNodeId,
          },
        });
      }

      const idpNode = await tendermintNdid.getNodeInfo(idpNodeId);
      if (idpNode == null) {
        throw new CustomError({
          errorType: errorType.UNQUALIFIED_IDP,
          details: {
            idpNodeId,
          },
        });
      }

      const {
        node_id_whitelist_active: idp_active,
        node_id_whitelist: idp_whitelist,
      } = idpNode;

      if (
        idp_active &&
        (idp_whitelist == null || idp_whitelist.indexOf(node_id) === -1)
      ) {
        throw new CustomError({
          errorType: errorType.NOT_IN_WHITELIST,
          details: {
            node_id: idpNodeId,
            whitelist: idp_whitelist,
            request_node_id: node_id,
          },
        });
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
 * @param {string} createRequestParams.purpose
 * @param {boolean} createRequestParams.bypass_identity_check
 * @param {string} createRequestParams.initial_salt
 * @param {string} [createRequestParams.request_type]
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
  let { node_id, initial_salt } = createRequestParams;
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
    purpose,
    bypass_identity_check,
    request_type,
  } = createRequestParams;
  const {
    synchronous = false,
    validateIdentifier: _validateIdentifier = true,
  } = options;
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
    const { allowed_mode_list } = await tendermintNdid.getAllowedModeList(
      purpose
    );
    if (!allowed_mode_list.includes(mode)) {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_MODE,
      });
    }

    if (request_type != null && request_type !== '') {
      const validRequestTypeList = await tendermintNdid.getRequestTypeList();
      if (!validRequestTypeList.includes(request_type)) {
        throw new CustomError({
          errorType: errorType.INVALID_REQUEST_TYPE,
        });
      }
    }

    const { supported_ial_list } = await tendermintNdid.getSupportedIALList();
    if (!supported_ial_list.includes(min_ial)) {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_IAL,
        details: {
          supported_ial_list,
          min_ial,
        },
      });
    }

    const { supported_aal_list } = await tendermintNdid.getSupportedAALList();
    if (!supported_aal_list.includes(min_aal)) {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_AAL,
        details: {
          supported_aal_list,
          min_aal,
        },
      });
    }

    if (_validateIdentifier) {
      if (mode === 1 || ((mode === 2 || mode === 3) && bypass_identity_check)) {
        validateIdentifier({
          namespace,
          identifier,
        });
      }
    }

    const requestId = await cacheDb.getRequestIdByReferenceId(
      node_id,
      reference_id
    );
    if (requestId) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_REFERENCE_ID,
      });
    }

    const dataUrlParsedRequestMessage = parseDataURL(request_message);
    let requestMessageMimeType;
    if (dataUrlParsedRequestMessage != null) {
      requestMessageMimeType = dataUrlParsedRequestMessage.mimeType.toString();
      const match = request_message.match(dataUrlRegex);
      if (
        match[4] &&
        match[4].endsWith('base64') &&
        request_message.search(/\s/) >= 0
      ) {
        throw new CustomError({
          errorType: errorType.DATA_URL_BASE64_MUST_NOT_CONTAIN_WHITESPACES,
        });
      }
    }

    await checkWhitelistCondition({
      node_id,
      idp_id_list,
    });

    const { receivers, receiversWithSid, receiversWithRefGroupCode } =
      await checkIdpListCondition({
        namespace,
        identifier,
        min_ial,
        min_aal,
        min_idp,
        idp_id_list,
        mode,
        supported_request_message_data_url_type_list: requestMessageMimeType
          ? [requestMessageMimeType]
          : undefined,
        bypass_identity_check,
      });

    if (data_request_list != null && data_request_list.length > 0) {
      await checkAsListCondition({
        data_request_list,
        namespace,
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

    if (!initial_salt) {
      initial_salt = utils.randomBase64Bytes(config.saltLength);
    } else {
      if (initial_salt.length < config.saltStrLength) {
        throw new CustomError({
          errorType: errorType.INITIAL_SALT_TOO_SHORT,
        });
      }
    }
    const request_message_salt = utils.generateRequestMessageSalt({
      initial_salt,
      namespace,
      identifier,
    });

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
      rp_id: node_id,
      request_message_salt,
      initial_salt,
      request_type,
      reference_id,
      callback_url,
    };

    // save request data to DB to send to AS via mq when authen complete
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
        receiversWithSid,
        receiversWithRefGroupCode,
        requestData,
      });
    } else {
      createRequestInternalAsync(createRequestParams, options, {
        node_id,
        request_id,
        request_message_salt,
        data_request_params_salt_list,
        receiversWithSid,
        receiversWithRefGroupCode,
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
    bypass_identity_check,
    request_type,
  } = createRequestParams;
  const {
    synchronous = false,
    sendCallbackToClient = true,
    callbackFnName,
    callbackAdditionalArgs,
    saveForRetryOnChainDisabled,
    apiVersion,
    ndidMemberAppType,
    ndidMemberAppVersion,
  } = options;
  const {
    node_id,
    request_id,
    request_message_salt,
    data_request_params_salt_list,
    receiversWithSid,
    receiversWithRefGroupCode,
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
            cryptoUtils.hashAlgorithm.SHA256,
            (dataRequest.request_params != null
              ? dataRequest.request_params
              : '') + data_request_params_salt_list[index]
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
      request_message_hash: utils.hash(
        cryptoUtils.hashAlgorithm.SHA256,
        request_message + request_message_salt
      ),
      idp_id_list,
      purpose,
      request_type,
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
            bypass_identity_check,
            receiversWithSid,
            receiversWithRefGroupCode,
            requestData,
          },
          {
            synchronous,
            sendCallbackToClient,
            callbackFnName,
            callbackAdditionalArgs,
            apiVersion,
            ndidMemberAppType,
            ndidMemberAppVersion,
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
          bypass_identity_check,
          receiversWithSid,
          receiversWithRefGroupCode,
          requestData,
        },
        {
          synchronous,
          sendCallbackToClient,
          callbackFnName,
          callbackAdditionalArgs,
          apiVersion,
          ndidMemberAppType,
          ndidMemberAppVersion,
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
        await callbackToClient({
          callbackUrl: callback_url,
          body: {
            node_id,
            type: 'create_request_result',
            success: false,
            reference_id,
            request_id,
            error: getErrorObjectForClient(error),
          },
          retry: true,
        });
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
    bypass_identity_check,
    receiversWithSid,
    receiversWithRefGroupCode,
    requestData,
  },
  {
    synchronous = false,
    sendCallbackToClient = true,
    callbackFnName,
    callbackAdditionalArgs,
    apiVersion,
    ndidMemberAppType,
    ndidMemberAppVersion,
  } = {}
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    // log request event: RP_CREATES_REQUEST
    TelemetryLogger.logRequestEvent(
      request_id,
      node_id,
      REQUEST_EVENTS.RP_CREATES_REQUEST,
      {
        api_spec_version: apiVersion,
        ndid_member_app_type: ndidMemberAppType,
        ndid_member_app_version: ndidMemberAppVersion,
        bypass_identity_check,
        idp_node_ids_with_registered_identity: bypass_identity_check
          ? receiversWithRefGroupCode.map(({ node_id }) => node_id)
          : undefined,
        idp_node_ids_without_registered_identity: bypass_identity_check
          ? receiversWithSid.map(({ node_id }) => node_id)
          : undefined,
      }
    );

    const creation_time = Date.now();

    await cacheDb.setRequestCreationMetadata(node_id, request_id, {
      creation_time,
    });

    await setTimeoutScheduler(node_id, request_id, request_timeout);

    const {
      min_idp: _1, // eslint-disable-line no-unused-vars
      reference_id: _3, // eslint-disable-line no-unused-vars
      callback_url: _4, // eslint-disable-line no-unused-vars
      namespace,
      identifier,
      ...requestDataWithoutLocalProps
    } = requestData;
    const requestDataWithoutDataRequestParams = {
      ...requestDataWithoutLocalProps,
      data_request_list: requestData.data_request_list.map((dataRequest) => {
        const { request_params, ...dataRequestWithoutParams } = dataRequest; // eslint-disable-line no-unused-vars
        return {
          ...dataRequestWithoutParams,
        };
      }),
    };

    // send request data to IDPs via message queue
    if (min_idp > 0) {
      const mqSendPromises = [];
      //mode 1 and on-the-fly onboard
      if (receiversWithSid.length > 0) {
        const mqMessageWithSid = {
          type: privateMessageType.CONSENT_REQUEST,
          namespace,
          identifier,
          ...requestDataWithoutDataRequestParams,
          creation_time,
          chain_id: tendermint.chainId,
          height,
        };
        mqSendPromises[0] = mq.send({
          receivers: receiversWithSid,
          message: mqMessageWithSid,
          senderNodeId: node_id,
          onSuccess: ({ mqDestAddress, receiverNodeId }) => {
            // log request event: RP_SENDS_REQUEST_TO_IDP
            TelemetryLogger.logRequestEvent(
              request_id,
              node_id,
              REQUEST_EVENTS.RP_SENDS_REQUEST_TO_IDP,
              {
                idp_node_id: receiverNodeId,
              }
            );

            nodeCallback.notifyMessageQueueSuccessSend({
              nodeId: node_id,
              getCallbackUrlFnName:
                'nodeCallback.getMessageQueueSendSuccessCallbackUrl',
              destNodeId: receiverNodeId,
              destIp: mqDestAddress.ip,
              destPort: mqDestAddress.port,
              requestId: request_id,
            });
          },
        });
      }
      if (requestData.mode === 2 || requestData.mode === 3) {
        if (receiversWithRefGroupCode.length > 0) {
          const reference_group_code =
            await tendermintNdid.getReferenceGroupCode(namespace, identifier);
          const mqMessageWithRefGroupCode = {
            type: privateMessageType.CONSENT_REQUEST,
            reference_group_code,
            ...requestDataWithoutDataRequestParams,
            creation_time,
            chain_id: tendermint.chainId,
            height,
          };
          mqSendPromises[1] = mq.send({
            receivers: receiversWithRefGroupCode,
            message: mqMessageWithRefGroupCode,
            senderNodeId: node_id,
            onSuccess: ({ mqDestAddress, receiverNodeId }) => {
              // log request event: RP_SENDS_REQUEST_TO_IDP
              TelemetryLogger.logRequestEvent(
                request_id,
                node_id,
                REQUEST_EVENTS.RP_SENDS_REQUEST_TO_IDP,
                {
                  idp_node_id: receiverNodeId,
                }
              );

              nodeCallback.notifyMessageQueueSuccessSend({
                nodeId: node_id,
                getCallbackUrlFnName:
                  'nodeCallback.getMessageQueueSendSuccessCallbackUrl',
                destNodeId: receiverNodeId,
                destIp: mqDestAddress.ip,
                destPort: mqDestAddress.port,
                requestId: request_id,
              });
            },
          });
        }
      }

      await Promise.all(mqSendPromises);
    }

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient({
          callbackUrl: callback_url,
          body: {
            node_id,
            type: 'create_request_result',
            success: true,
            reference_id,
            request_id,
            creation_block_height: `${tendermint.chainId}:${height}`,
          },
          retry: true,
        });
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
        await callbackToClient({
          callbackUrl: callback_url,
          body: {
            node_id,
            type: 'create_request_result',
            success: false,
            reference_id,
            request_id,
            error: getErrorObjectForClient(error),
          },
          retry: true,
        });
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
    cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
    cacheDb.removeRequestCreationMetadata(nodeId, requestId),
  ]);
}
