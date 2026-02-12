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

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import {
  getIncomingRequestStatusUpdateCallbackUrl,
  respondDataToRP,
  respondErrorToRP,
} from '.';
import { validateAuthorization, USAGE_TYPE } from '../authorization_token';
import yourDataRequestStatus from '../request_status';

import * as common from '../../common';
import domain from '../../domain';
import * as tendermintNdid from '../../../tendermint/ndid';
import * as cacheDb from '../../../db/cache';
import * as dataDb from '../../../db/data';
import * as mq from '../../../mq';
import privateMessageType from '../../../mq/message/type';
import { callbackToClient } from '../../../callback';
import * as utils from '../../../utils';
import * as jwtUtils from '../../../utils/jwt';

import logger from '../../../logger';

export async function processMessage(nodeId, messageId, message) {
  const requestId = message.request_id;
  logger.debug({
    message: 'Processing YourData message',
    nodeId,
    messageId,
    requestId,
  });

  try {
    if (message.type === privateMessageType.YOURDATA_DATA_REQUEST) {
      await processDataRequest(nodeId, message);
    } else if (
      message.type === privateMessageType.YOURDATA_DATA_DECRYPTION_KEY_REQUEST
    ) {
      await processDataDecryptionKeyRequest(nodeId, message);
    } else if (message.type === privateMessageType.YOURDATA_STATUS_SYNC) {
      await processDataStatusSync(nodeId, message);
    } else {
      logger.warn({
        message: 'Cannot process unknown message type',
        type: message.type,
      });
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing YourData message from message queue',
      cause: error,
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'as.getErrorCallbackUrl',
      action: 'yourdata.as.processMessage',
      error: err,
      requestId,
    });
    throw err;
  }
}

async function processDataRequest(nodeId, message) {
  // TODO: telemetry logging
  //
  // log request event: AS_RECEIVES_RP_REQUEST
  // TelemetryLogger.logRequestEvent(
  //   requestId,
  //   nodeId,
  //   REQUEST_EVENTS.AS_RECEIVES_RP_REQUEST
  // );
  //

  const {
    request_id,
    service_id,
    service_version,
    service_extension,
    rp_node_id: requester_node_id,
    namespace,
    identifier,
    request_params,
    authorization,
    request_time, // unix time in msec
    request_timeout, // in seconds
  } = message;

  // check request is still active / not timed out yet
  // since there may be cases where data request message arrived later than status sync (timeout) message
  // due to retries
  const requestTimeoutMsec = request_timeout * 1000;
  const requestTimeoutAt = request_time + requestTimeoutMsec;
  const timedout = Date.now() > requestTimeoutAt;
  if (timedout) {
    throw new CustomError({
      errorType: errorType.REQUEST_IS_TIMED_OUT,
      details: {
        requestId: request_id,
      },
    });
  }

  // parse "authorization" JWT payload for subsequent checks
  const parsedJwt = jwtUtils.parseJWT(authorization);

  // get by key version
  const signingPublicKey = await tendermintNdid.getNodeSigningPubKey(
    nodeId,
    parsedJwt.payload.as_node_signing_key_version
  );

  // verify token "authorization" signature (signed by AS/this node)
  const signatureValid = utils.verifySignature(
    signingPublicKey.algorithm,
    parsedJwt.signature,
    signingPublicKey.public_key,
    parsedJwt.token
  );
  if (!signatureValid) {
    throw new CustomError({
      errorType: errorType.INVALID_SIGNATURE, // FIXME: change to specific error e.g. invalid authorization token signature
      details: {
        requestId: request_id,
      },
    });
  }

  // check source/sender RP node ID
  // - exists / valid
  // - active
  // - in whitelist (if whitelist is active/in-use)
  const requesterNodeInfo = await tendermintNdid.getNodeInfo(requester_node_id);
  if (requesterNodeInfo == null) {
    logger.warn({
      message: 'Unknown requester node',
      request_id,
      service_id,
      requester_node_id,
    });
    return;
  }
  if (!requesterNodeInfo.active) {
    logger.warn({
      message: 'Requester node is not active',
      request_id,
      service_id,
      requester_node_id,
    });
    return;
  }

  const requesterNodeDomainPermission =
    await tendermintNdid.getDomainNodePermission({
      nodeId: requester_node_id,
      domain: domain.YOURDATA,
    });
  if (!requesterNodeDomainPermission.allowed) {
    logger.warn({
      message: 'Requester node is not allowed to make domain request',
      domain: domain.YOURDATA,
      request_id,
      service_id,
      requester_node_id,
    });
    return;
  }

  // not needed?
  // check destination/self AS node ID
  // - active
  // - in whitelist (if whitelist is active/in-use)
  // const nodeInfo = await tendermintNdid.getNodeInfo(nodeId);
  // if (!nodeInfo.active) {
  //   logger.debug({
  //     message: 'This node is not active',
  //     nodeId,
  //   });
  //   return;
  // }

  // const nodeDomainPermission =
  //   await tendermintNdid.getDomainNodePermission({
  //     nodeId,
  //     domain: domain.YOURDATA,
  //   });
  // if (!nodeDomainPermission.allowed) {
  //   logger.debug({
  //     message: 'This node is not allowed to serve domain request',
  //     nodeId,
  //     domain: domain.YOURDATA,
  //   });
  //   return;
  // }

  // get AS service data
  const service = await dataDb.getYourDataASService(nodeId, service_id);
  if (service == null) {
    logger.warn({
      message: 'Received data request with unknown/unregistered service',
      request_id,
      service_id,
      requester_node_id,
    });
    return;
  }

  if (!service.service_availability) {
    logger.warn({
      message: 'Service disabled',
      request_id,
      service_id,
      requester_node_id,
    });
    // TODO: clarify how this should be handled with NDID.
    // simply drop the request or return some kind of error back to RP?
    return;
  }

  // supported namespace check
  if (!service.supported_namespace_list.includes(namespace)) {
    logger.warn({
      message: 'Unsupported namespace',
      request_id,
      service_id,
      requester_node_id,
      namespace,
    });
    // TODO: clarify with NDID how this should be handled.
    // simply drop the request or return some kind of error back to RP?
    return;
  }

  // supported authorization check
  //
  // token usage types:
  // - one_time
  // - continuous_with_expire
  // - continuous_no_expire

  // authorization types:
  // - no_token_needed: TODO: clarify when and how a request falls into this case
  // - token_one_time
  // - token_continuous_with_expire
  // - token_continuous_no_expire
  if (
    (parsedJwt.payload.usage_type === USAGE_TYPE.ONE_TIME &&
      !service.supported_authorization.includes('token_one_time')) ||
    (parsedJwt.payload.usage_type === USAGE_TYPE.CONTINUOUS_WITH_EXPIRE &&
      !service.supported_authorization.includes(
        'token_continuous_with_expire'
      )) ||
    (parsedJwt.payload.usage_type === USAGE_TYPE.CONTINUOUS_NO_EXPIRE &&
      !service.supported_authorization.includes('token_continuous_no_expire'))
  ) {
    logger.warn({
      message: 'Unsupported authorization',
      request_id,
      service_id,
      requester_node_id,
      token_usage_type: parsedJwt.payload.usage_type,
    });
    // TODO: clarify with NDID how this should be handled.
    // simply drop the request or return some kind of error back to RP?
    return;
  }

  // validate data in "authorization"
  await validateAuthorization({
    parsedAuthorizationTokenPayload: parsedJwt.payload,
    rpNodeId: requester_node_id,
    asNodeId: nodeId,
    namespace,
    identifier,
    serviceId: service_id,
    serviceExtension: service_extension,
  });

  // --- end of validations ---

  // save request data to cache
  const request = {
    request_id,
    service_id,
    service_version,
    service_extension,
    requester_node_id,
    namespace,
    identifier,
    request_params,
    authorization,
    request_time,
    request_timeout,
  };
  // cache TTL - request timeout + message send retry duration
  const ttlSeconds = request_timeout + 600; // request timeout + 10 minutes
  await Promise.all([
    cacheDb.setYourDataRequestData(nodeId, request_id, request, ttlSeconds),
    cacheDb.setYourDataCurrentRequestStatus(
      nodeId,
      request_id,
      yourDataRequestStatus.PENDING,
      ttlSeconds
    ),
  ]);

  // callback to AS

  logger.info({
    message: 'Sending callback to AS',
  });
  logger.debug({
    message: 'Callback to AS',
    service_id,
    request_params,
  });

  // AS node -> AS member app / Proxy app
  await callbackToClient({
    getCallbackUrlFnName: 'yourdata.as.getServiceCallbackUrl',
    getCallbackUrlFnArgs: [nodeId, service_id],
    body: {
      node_id: nodeId, // AS node ID e.g. "as1"
      type: 'yourdata.data_request',
      request_id,
      service_id,
      service_version,
      service_extension,
      requester_node_id,
      namespace,
      identifier,
      request_params,
      authorization,
      request_time,
      request_timeout,
    },
    retry: true,
    shouldRetryFnName: 'yourdata.as.isRequestNotTimedOut',
    shouldRetryArguments: [nodeId, request_id],
    responseCallbackFnName: 'yourdata.as.afterGotDataFromCallback',
    dataForResponseCallback: {
      nodeId,
      requestId: request_id,
      // apiVersion: config.callbackApiVersion,
    },
  });
}

// for synchronous response from callback
export async function afterGotDataFromCallback(
  { error, response, body },
  additionalData
) {
  const { nodeId, requestId } = additionalData;

  try {
    if (error) throw error;
    if (response.status === 204) {
      return;
    }
    if (response.status !== 200) {
      throw new CustomError({
        errorType: errorType.INVALID_HTTP_RESPONSE_STATUS_CODE,
        details: {
          status: response.status,
          body,
        },
      });
    }

    // Response with 200
    let result;
    try {
      result = JSON.parse(body);

      logger.info({
        message: 'Received data from AS',
      });
      logger.debug({
        message: 'Data from AS',
        result,
      });
    } catch (error) {
      throw new CustomError({
        errorType: errorType.CANNOT_PARSE_JSON,
        cause: error,
      });
    }
    if (result.error_code == null) {
      if (result.data == null) {
        throw new CustomError({
          errorType: errorType.MISSING_DATA_IN_AS_DATA_RESPONSE,
          details: {
            result,
          },
        });
      }
      if (typeof result.data !== 'string') {
        throw new CustomError({
          errorType: errorType.INVALID_DATA_TYPE_IN_AS_DATA_RESPONSE,
          details: {
            dataType: typeof result.data,
          },
        });
      }

      await respondDataToRP({
        node_id: nodeId,
        request_id: requestId,
        data: result.data,
      });
    } else {
      if (typeof result.error_code !== 'number') {
        throw new CustomError({
          errorType: errorType.INVALID_ERROR_CODE_TYPE_IN_AS_RESPONSE,
          details: {
            errorCodeType: typeof result.error_code,
          },
        });
      }
      if (typeof result.error_message !== 'string') {
        throw new CustomError({
          errorType: errorType.INVALID_ERROR_CODE_TYPE_IN_AS_RESPONSE,
          details: {
            errorMessageType: typeof result.error_message,
          },
        });
      }

      await respondErrorToRP({
        node_id: nodeId,
        request_id: requestId,
        error_code: result.error_code,
        error_message: result.error_message,
      });
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing data response from AS',
      cause: error,
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'as.getErrorCallbackUrl',
      action: 'yourdata.as.afterGotDataFromCallback',
      error: err,
      requestId,
    });
  }
}

async function processDataDecryptionKeyRequest(nodeId, message) {
  const { request_id, encrypted_data_hash_base64 } = message;

  // check request is still active / not timed out yet
  // -> get request data from cache if not exist assume timed out
  const request = await cacheDb.getYourDataRequestData(nodeId, request_id);
  if (request == null) {
    logger.info({
      message: 'Request is already timed out or does not exist',
      requestId: request_id,
    });
    return;
  }

  const requesterNodeId = request.requester_node_id;

  // request status update
  // status: "data_decryption_key_requested"

  await cacheDb.setYourDataCurrentRequestStatus(
    nodeId,
    request_id,
    yourDataRequestStatus.DATA_DECRYPTION_KEY_REQUESTED,
    null,
    true
  );

  // callback to AS app
  const callbackUrl = await getIncomingRequestStatusUpdateCallbackUrl();
  if (callbackUrl != null) {
    const eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.request_status',
      requester_node_id: requesterNodeId,
      as_node_id: nodeId,
      request_id,
      request_timeout: request.request_timeout,
      timed_out: false,
      status: yourDataRequestStatus.DATA_DECRYPTION_KEY_REQUESTED,
    };

    await callbackToClient({
      getCallbackUrlFnName:
        'yourdata.as.getIncomingRequestStatusUpdateCallbackUrl',
      body: eventDataForCallback,
      retry: true,
    });
  }

  // get key from cache
  const dataEncryptionKey = await cacheDb.getYourDataDataEncryptionKey(
    nodeId,
    request_id
  );
  const encryptionKeyBase64 = dataEncryptionKey.key_base64;

  // check encrypted data hash
  if (
    encrypted_data_hash_base64 !== dataEncryptionKey.encrypted_data_hash_base64
  ) {
    throw new CustomError({
      errorType: errorType.INVALID_ENCRYPTED_DATA_HASH,
      details: {
        request_id,
        requester_node_id: requesterNodeId,
        encrypted_data_hash_base64,
        expected_encrypted_data_hash_base64:
          dataEncryptionKey.encrypted_data_hash_base64,
      },
    });
  }

  // send key to RP

  const nodeInfo = await tendermintNdid.getNodeInfo(requesterNodeId);
  if (nodeInfo == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: {
        request_id,
        requester_node_id: requesterNodeId,
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
          requester_node_id: requesterNodeId,
        },
      });
    }
    receivers = [
      {
        node_id: requesterNodeId,
        encryption_public_key: nodeInfo.encryption_public_key,
        proxy: {
          node_id: nodeInfo.proxy.node_id,
          encryption_public_key: nodeInfo.proxy.encryption_public_key,
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
          requester_node_id: requesterNodeId,
        },
      });
    }
    receivers = [
      {
        node_id: requesterNodeId,
        encryption_public_key: nodeInfo.encryption_public_key,
        ip: nodeInfo.mq[0].ip,
        port: nodeInfo.mq[0].port,
      },
    ];
  }

  await mq.send({
    receivers,
    message: {
      type: privateMessageType.YOURDATA_DATA_DECRYPTION_KEY_RESPONSE,
      request_id,
      as_node_id: nodeId,
      key_base64: encryptionKeyBase64,
    },
    senderNodeId: nodeId,
    onSuccess: ({ mqDestAddress, receiverNodeId }) => {
      // FIXME
      //
      // log request event: AS_SENDS_DATA_TO_RP
      // TelemetryLogger.logRequestEvent(
      //   data.request_id,
      //   nodeId,
      //   REQUEST_EVENTS.AS_SENDS_DATA_TO_RP,
      //   {
      //     service_id: data.service_id,
      //   }
      // );
      // TODO
      // request status update
      // status: "encrypted_data_sent" if data is sent
      // status: "error" if error is sent
      // callback to AS app
      //
      // FIXME
      //
      // nodeCallback.notifyMessageQueueSuccessSend({
      //   nodeId,
      //   getCallbackUrlFnName:
      //     'nodeCallback.getMessageQueueSendSuccessCallbackUrl',
      //   destNodeId: receiverNodeId,
      //   destIp: mqDestAddress.ip,
      //   destPort: mqDestAddress.port,
      //   requestId: data.request_id,
      // });
    },
  });

  // request status update
  // status: "data_decryption_key_available"

  await cacheDb.setYourDataCurrentRequestStatus(
    nodeId,
    request_id,
    yourDataRequestStatus.DATA_DECRYPTION_KEY_AVAILABLE,
    null,
    true
  );

  // callback to AS app
  if (callbackUrl != null) {
    const eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.request_status',
      requester_node_id: request.requester_node_id,
      as_node_id: nodeId,
      request_id,
      request_timeout: request.request_timeout,
      timed_out: false,
      status: yourDataRequestStatus.DATA_DECRYPTION_KEY_AVAILABLE,
    };

    await callbackToClient({
      getCallbackUrlFnName:
        'yourdata.as.getIncomingRequestStatusUpdateCallbackUrl',
      body: eventDataForCallback,
      retry: true,
    });
  }
}

async function processDataStatusSync(nodeId, message) {
  const { request_id, status, timed_out } = message;

  // check request is still active / not timed out yet
  // -> get request data from cache if not exist assume timed out
  const request = await cacheDb.getYourDataRequestData(nodeId, request_id);
  if (request == null) {
    logger.info({
      message: 'Request is already timed out or does not exist',
      requestId: request_id,
    });
    return;
  }

  // possible cases:
  // - completed
  // - timeout

  // accept only expected statuses and prevent others
  //
  // expected status list does not include "pending" since AS side does not have callback status update for it
  if (
    ![
      yourDataRequestStatus.DATA_DECRYPTION_PENDING,
      yourDataRequestStatus.DATA_DECRYPTION_KEY_REQUESTED,
      yourDataRequestStatus.DATA_DECRYPTION_KEY_AVAILABLE,
      yourDataRequestStatus.COMPLETED,
    ].includes(status)
  ) {
    logger.debug({
      message: 'Received unexpected status. Do nothing.',
      status,
    });
    return;
  }

  let currentTimedOut;
  if (status === 'completed') {
    currentTimedOut = false;
  } else if (timed_out) {
    const currentRequestStatus = await cacheDb.getYourDataCurrentRequestStatus(
      nodeId,
      request_id
    );
    currentTimedOut = true;

    logger.warn({
      message: 'Current status on timeout not matched',
      statusFromRP: status,
      localStatus: currentRequestStatus,
    });
  }

  // the request has reached its end state (completed or timed out)
  // cleanup
  if (status === 'completed' || timed_out) {
    // remove request data from cache
    await Promise.all([
      cacheDb.removeYourDataRequestData(nodeId, request_id),
      cacheDb.removeYourDataCurrentRequestStatus(nodeId, request_id),
      cacheDb.removeYourDataDataEncryptionKey(nodeId, request_id),
    ]);
  }

  // request status update
  // status: (varied)

  // callback to AS app
  const callbackUrl = await getIncomingRequestStatusUpdateCallbackUrl();
  if (callbackUrl != null) {
    const eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.request_status',
      requester_node_id: request.requester_node_id,
      as_node_id: nodeId,
      request_id,
      request_timeout: request.request_timeout,
      timed_out: currentTimedOut,
      status,
    };

    await callbackToClient({
      getCallbackUrlFnName:
        'yourdata.as.getIncomingRequestStatusUpdateCallbackUrl',
      body: eventDataForCallback,
      retry: true,
    });
  }
}
