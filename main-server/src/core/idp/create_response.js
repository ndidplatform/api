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

import { getIdentityInfo } from '../identity';
import * as tendermintNdid from '../../tendermint/ndid';
import * as tendermint from '../../tendermint';
import * as cacheDb from '../../db/cache';
import * as nodeCallback from '../node_callback';
import * as mq from '../../mq';
import privateMessageType from '../../mq/message/type';

import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import * as utils from '../../utils';
import { getErrorObjectForClient } from '../../utils/error';
import logger from '../../logger';
import TelemetryLogger, { REQUEST_EVENTS } from '../../telemetry';

import * as config from '../../config';
import { role } from '../../node';

export async function createResponse(createResponseParams, options = {}) {
  let { node_id } = createResponseParams;
  const {
    request_id,
    ial,
    aal,
    accessor_id,
    signature,
    error_code,
  } = createResponseParams;
  const { apiVersion, ndidMemberAppType, ndidMemberAppVersion } = options;

  if (role === 'proxy') {
    if (node_id == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    node_id = config.nodeId;
  }

  // log request event: IDP_RECEIVES_AUTH_RESULT
  TelemetryLogger.logRequestEvent(
    request_id,
    node_id,
    REQUEST_EVENTS.IDP_RECEIVES_AUTH_RESULT,
    {
      api_spec_version: apiVersion.toString(),
      ndid_member_app_type: ndidMemberAppType,
      ndid_member_app_version: ndidMemberAppVersion,
    }
  );

  try {
    const request = await tendermintNdid.getRequestDetail({
      requestId: request_id,
    });
    if (request == null) {
      throw new CustomError({
        errorType: errorType.REQUEST_NOT_FOUND,
        details: {
          requestId: request_id,
        },
      });
    }
    if (request.closed) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_CLOSED,
        details: {
          requestId: request_id,
        },
      });
    }
    if (request.timed_out) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_TIMED_OUT,
        details: {
          requestId: request_id,
        },
      });
    }

    // check current responses with min_idp
    const nonErrorResponseCount = request.response_list.filter(
      ({ error_code }) => error_code == null
    ).length;
    if (nonErrorResponseCount >= request.min_idp) {
      throw new CustomError({
        errorType: errorType.ENOUGH_IDP_RESPONSE,
      });
    }
    const remainingPossibleResponseCount =
      request.idp_id_list.length - request.response_list.length;
    if (
      nonErrorResponseCount + remainingPossibleResponseCount <
      request.min_idp
    ) {
      throw new CustomError({
        errorType: errorType.ENOUGH_IDP_RESPONSE,
      });
    }

    const requestData = await cacheDb.getRequestReceivedFromMQ(
      node_id,
      request_id
    );
    if (!requestData) {
      throw new CustomError({
        errorType: errorType.UNKNOWN_CONSENT_REQUEST,
      });
    }

    if (error_code != null) {
      // check if error code exists
      const error_code_list = await tendermintNdid.getErrorCodeList('idp');
      if (
        error_code_list.find((error) => error.error_code === error_code) == null
      ) {
        throw new CustomError({
          errorType: errorType.INVALID_ERROR_CODE,
        });
      }

      createErrorResponseInternal(createResponseParams, {
        nodeId: node_id,
        requestData,
        apiVersion,
      });
    } else {
      if (ial < request.min_ial) {
        throw new CustomError({
          errorType: errorType.IAL_IS_LESS_THAN_REQUEST_MIN_IAL,
          details: {
            requestId: request_id,
          },
        });
      }
      if (aal < request.min_aal) {
        throw new CustomError({
          errorType: errorType.AAL_IS_LESS_THAN_REQUEST_MIN_AAL,
          details: {
            requestId: request_id,
          },
        });
      }

      let accessorPublicKey;
      if (request.mode === 2 || request.mode === 3) {
        let referenceGroupCode;
        if (requestData.reference_group_code != null) {
          referenceGroupCode = requestData.reference_group_code;
        } else {
          // Incoming request without indentity onboard/created on the platform
          // doesn't have reference group code
          // (on-the-fly onboard flow)
          referenceGroupCode = await tendermintNdid.getReferenceGroupCode(
            requestData.namespace,
            requestData.identifier
          );
          if (referenceGroupCode == null) {
            throw new CustomError({
              errorType: errorType.IDENTITY_NOT_FOUND,
              details: {
                namespace: requestData.namespace,
                identifier: requestData.identifier,
              },
            });
          }
        }
        //check association mode list
        //idp associate with only mode 2 won't be able to response mode 3 request
        const identityInfo = await getIdentityInfo({
          nodeId: node_id,
          referenceGroupCode,
        });
        if (identityInfo == null) {
          throw new CustomError({
            errorType: errorType.IDENTITY_NOT_FOUND_ON_IDP,
            details: {
              referenceGroupCode,
              nodeId: node_id,
            },
          });
        }
        const { mode_list, ial: declaredIal } = identityInfo;
        if (!mode_list.includes(request.mode)) {
          throw new CustomError({
            errorType: errorType.IDENTITY_MODE_MISMATCH,
          });
        }

        if (accessor_id == null) {
          throw new CustomError({
            errorType: errorType.ACCESSOR_ID_NEEDED,
          });
        }

        const accessorReferenceGroupCode = await tendermintNdid.getReferenceGroupCodeByAccessorId(
          accessor_id
        );

        if (referenceGroupCode !== accessorReferenceGroupCode) {
          throw new CustomError({
            errorType: errorType.ACCESSOR_IS_NOT_IN_REQUEST_REFERENCE_GROUP,
            details: {
              referenceGroupCode,
              accessorReferenceGroupCode,
              accessor_id,
            },
          });
        }

        accessorPublicKey = await tendermintNdid.getAccessorKey(accessor_id);
        if (accessorPublicKey == null) {
          throw new CustomError({
            errorType: errorType.ACCESSOR_PUBLIC_KEY_NOT_FOUND_OR_NOT_ACTIVE,
            details: {
              accessor_id,
            },
          });
        }

        if (ial !== declaredIal) {
          throw new CustomError({
            errorType: errorType.WRONG_IAL,
          });
        }

        if (
          !utils.verifyResponseSignature(
            signature,
            accessorPublicKey,
            requestData.request_message,
            requestData.initial_salt,
            request_id
          )
        ) {
          throw new CustomError({
            errorType: errorType.INVALID_ACCESSOR_SIGNATURE,
            details: {
              requestId: request_id,
            },
          });
        }
      }

      createResponseInternal(createResponseParams, {
        nodeId: node_id,
        requestData,
        accessorPublicKey,
        apiVersion,
      });
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create IdP response',
      cause: error,
    });
    logger.error({ err });
    throw err;
  }
}

/**
 * Create a (consent) response to a request
 *
 * @param {Object} createResponseParams
 * @param {string} createResponseParams.node_id
 * @param {string} createResponseParams.reference_id
 * @param {string} createResponseParams.callback_url
 * @param {string} createResponseParams.request_id
 * @param {number} createResponseParams.aal
 * @param {number} createResponseParams.ial
 * @param {string} createResponseParams.status
 * @param {string} createResponseParams.accessor_id
 * @param {string} createResponseParams.signature
 */
export async function createResponseInternal(
  createResponseParams,
  additionalParams = {}
) {
  const {
    reference_id,
    callback_url,
    request_id,
    aal,
    ial,
    status,
    accessor_id,
    signature,
  } = createResponseParams;
  const { nodeId, requestData, apiVersion } = additionalParams;
  try {
    const request = await tendermintNdid.getRequest({ requestId: request_id });
    const mode = request.mode;

    const dataToBlockchain = {
      request_id,
      aal,
      ial,
      status,
      signature,
    };

    await tendermintNdid.createIdpResponse(
      dataToBlockchain,
      nodeId,
      'idp.createResponseAfterBlockchain',
      [
        {
          nodeId,
          reference_id,
          callback_url,
          request_id,
          mode,
          accessor_id,
          rp_id: requestData.rp_id,
        },
        {
          apiVersion,
        },
      ],
      true
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create IdP response',
      cause: error,
    });
    logger.error({ err });
    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'response_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(err),
      },
      retry: true,
    });
  }
}

export async function createErrorResponseInternal(
  createResponseParams,
  additionalParams = {}
) {
  const {
    reference_id,
    callback_url,
    request_id,
    error_code,
  } = createResponseParams;
  const { nodeId, requestData, apiVersion } = additionalParams;
  try {
    const dataToBlockchain = {
      request_id,
      error_code,
    };

    await tendermintNdid.createIdpResponse(
      dataToBlockchain,
      nodeId,
      'idp.createResponseAfterBlockchain',
      [
        {
          nodeId,
          reference_id,
          callback_url,
          request_id,
          error_code,
          rp_id: requestData.rp_id,
        },
        {
          apiVersion,
        },
      ],
      true
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create IdP response',
      cause: error,
    });
    logger.error({ err });
    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'response_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(err),
      },
      retry: true,
    });
  }
}

export async function createResponseAfterBlockchain(
  { height, error, chainDisabledRetryLater },
  {
    nodeId,
    reference_id,
    callback_url,
    request_id,
    mode,
    accessor_id,
    rp_id,
    error_code,
  }
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    // log request event: IDP_CREATES_RESPONSE
    TelemetryLogger.logRequestEvent(
      request_id,
      nodeId,
      REQUEST_EVENTS.IDP_CREATES_RESPONSE
    );

    await sendResponseToRP({
      nodeId,
      request_id,
      mode,
      accessor_id,
      rp_id,
      height,
      error_code,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'response_result',
        success: true,
        reference_id,
        request_id,
      },
      retry: true,
    });
  } catch (error) {
    logger.error({
      message: 'Create IdP response after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'response_result',
        success: false,
        reference_id: reference_id,
        request_id: request_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });
  }
}

async function sendResponseToRP({
  nodeId,
  request_id,
  mode,
  accessor_id,
  rp_id,
  height,
  error_code,
}) {
  logger.info({
    message: 'Query MQ destination for RP',
  });
  logger.debug({
    message: 'Query MQ destination for RP',
    rp_id,
  });

  const nodeInfo = await tendermintNdid.getNodeInfo(rp_id);
  if (nodeInfo == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: {
        request_id,
        height,
      },
    });
  }

  let receivers;
  if (nodeInfo.proxy != null) {
    if (nodeInfo.proxy.mq == null || nodeInfo.proxy.mq.length === 0) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id,
          nodeId: rp_id,
        },
      });
    }
    receivers = [
      {
        node_id: rp_id,
        public_key: nodeInfo.public_key,
        proxy: {
          node_id: nodeInfo.proxy.node_id,
          public_key: nodeInfo.proxy.public_key,
          ip: nodeInfo.proxy.mq[0].ip,
          port: nodeInfo.proxy.mq[0].port,
          config: nodeInfo.proxy.config,
        },
      },
    ];
  } else {
    if (nodeInfo.mq == null || nodeInfo.mq.length === 0) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id,
          nodeId: rp_id,
        },
      });
    }
    receivers = [
      {
        node_id: rp_id,
        public_key: nodeInfo.public_key,
        ip: nodeInfo.mq[0].ip,
        port: nodeInfo.mq[0].port,
      },
    ];
  }
  await mq.send({
    receivers,
    message: {
      type: privateMessageType.IDP_RESPONSE,
      request_id,
      mode,
      accessor_id,
      idp_id: nodeId,
      error_code,
      chain_id: tendermint.chainId,
      height,
    },
    senderNodeId: nodeId,
    onSuccess: ({ mqDestAddress, receiverNodeId }) => {
      // log request event: IDP_RESPONDS_TO_RP
      TelemetryLogger.logRequestEvent(
        request_id,
        nodeId,
        REQUEST_EVENTS.IDP_RESPONDS_TO_RP
      );

      nodeCallback.notifyMessageQueueSuccessSend({
        nodeId,
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
