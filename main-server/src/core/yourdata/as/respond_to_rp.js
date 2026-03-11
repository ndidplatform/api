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

import crypto from 'crypto';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import { getIncomingRequestStatusUpdateCallbackUrl } from '.';
import * as yourDataRequestQueueManager from '../request_queue_manager';
import yourDataRequestStatus from '../request_status';
import { packData } from '../../as_data_helper';
import domain from '../../domain';
import * as nodeCallback from '../../node_callback';

import * as tendermintNdid from '../../../tendermint/ndid';
import * as cacheDb from '../../../db/cache';
import * as mq from '../../../mq';
import privateMessageType from '../../../mq/message/type';
import { callbackToClient } from '../../../callback';
import * as utils from '../../../utils';
import * as cryptoUtils from '../../../utils/crypto';
import TelemetryLogger, { YOURDATA_REQUEST_EVENTS } from '../../../telemetry';
import logger from '../../../logger';

import * as config from '../../../config';
import { role } from '../../../node';

export async function respondDataToRP(
  respondDataToRPParams,
  { apiVersion, ndidMemberAppType, ndidMemberAppVersion } = {}
) {
  let { node_id: nodeId } = respondDataToRPParams;
  const { request_id } = respondDataToRPParams;

  if (role === 'proxy') {
    if (nodeId == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    nodeId = config.nodeId;
  }

  try {
    await yourDataRequestQueueManager.enqueue(
      nodeId,
      request_id,
      respondDataToRPInternal,
      {
        ...respondDataToRPParams,
        node_id: nodeId,
      },
      { apiVersion, ndidMemberAppType, ndidMemberAppVersion }
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot respond data to RP',
      params: respondDataToRPParams,
      cause: error,
    });
  }
}

// use this function with request process queue
// to prevent some inconsistencies with status change
// e.g. AS app call send data API multiple times, timeout status sync from RP happening at the same time
async function respondDataToRPInternal(
  respondDataToRPParams,
  { apiVersion, ndidMemberAppType, ndidMemberAppVersion } = {}
) {
  let { node_id: nodeId } = respondDataToRPParams;
  const { request_id, data } = respondDataToRPParams;

  try {
    // check request is still active / not timed out yet
    // -> get request data from cache if not exist assume timed out
    const request = await cacheDb.getYourDataRequestData(nodeId, request_id);
    if (request == null) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_TIMED_OUT_OR_NOT_EXIST,
      });
    }

    // get request status and check state. If at wrong state, return error
    const currentRequestStatus = await cacheDb.getYourDataCurrentRequestStatus(
      nodeId,
      request_id
    );
    if (currentRequestStatus !== yourDataRequestStatus.PENDING) {
      throw new CustomError({
        errorType: errorType.UNEXPECTED_ACTION_AT_CURRENT_REQUEST_STATE,
        details: {
          currentRequestStatus,
        },
      });
    }

    // check if request is not yet timed out
    const requestTimeoutMsec = request.request_timeout * 1000;
    const requestTimeoutAt = request.request_time + requestTimeoutMsec;
    const timedout = Date.now() > requestTimeoutAt;
    if (timedout) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_TIMED_OUT,
        details: {
          requestId: request_id,
        },
      });
    }

    const packedData = await packData({
      data,
      compressMinLength: config.asDataCompressMinLength,
      maxUncompressedLength: config.asDataMaxUncompressedLength,
      maxResultDataLength: config.asDataMaxLength,
    });

    const dataHashBase64 = utils.hash(
      cryptoUtils.hashAlgorithm.SHA256,
      Buffer.from(packedData.buffer_base64, 'base64')
    );

    // generate encryption key (symmetric key)
    let encryptionKey = crypto.randomBytes(32);

    // encrypt packedData
    let encryptedPackedDataBuffer = cryptoUtils.encryptAES256GCM(
      encryptionKey,
      Buffer.from(packedData.buffer_base64, 'base64'),
      false
    );

    let encryptedPackedData = {
      buffer_base64: encryptedPackedDataBuffer.toString('base64'),
      metadata: packedData.metadata,
    };

    let encryptedDataHashBase64 = utils.hash(
      cryptoUtils.hashAlgorithm.SHA256,
      encryptedPackedDataBuffer
    );

    // save encryption key to cache if it does not already exist
    const set = await cacheDb.setYourDataDataEncryptionKey(nodeId, request_id, {
      key_base64: encryptionKey.toString('base64'),
      data_hash_base64: dataHashBase64,
      encrypted_data_hash_base64: encryptedDataHashBase64,
    });
    if (!set) {
      // key already exists -> cause: possible multiple call / retry
      // use existing key instead

      const dataEncryptionKey = await cacheDb.getYourDataDataEncryptionKey(
        nodeId,
        request_id
      );

      if (dataHashBase64 !== dataEncryptionKey.data_hash_base64) {
        throw new CustomError({
          errorType: errorType.DUPLICATE_DATA_RESPONSE_WITH_DIFFERENT_DATA,
        });
      }

      encryptionKey = Buffer.from(dataEncryptionKey.key_base64, 'base64');

      encryptedPackedDataBuffer = cryptoUtils.encryptAES256GCM(
        encryptionKey,
        Buffer.from(packedData.buffer_base64, 'base64'),
        false
      );

      encryptedPackedData = {
        buffer_base64: encryptedPackedDataBuffer.toString('base64'),
        metadata: packedData.metadata,
      };

      encryptedDataHashBase64 = utils.hash(
        cryptoUtils.hashAlgorithm.SHA256,
        encryptedPackedDataBuffer
      );
    }

    // signature salt
    const salt = utils.randomBase64Bytes(config.saltLength);
    const data_salt = utils.generateDataSalt({
      request_id,
      service_id: request.service_id,
      initial_salt: salt,
    });

    // create signature (sign on data)
    const signingPublicKey = await tendermintNdid.getNodeSigningPubKey(nodeId);
    const signatureBuffer = await utils.createSignature(
      signingPublicKey.algorithm,
      signingPublicKey.version,
      data + data_salt,
      nodeId
    );
    const signature = signatureBuffer.toString('base64');

    const requesterNodeId = request.requester_node_id;

    // prepare data for data encryption key request retry for RP
    //
    // - encrypt "encryptionKey" with node's public key
    // - sign encrypted key with other metadata (request ID, requester node ID)

    const nodeInfo = await tendermintNdid.getNodeInfo(nodeId);

    const { encryptedSymKey, encryptedMessage } = utils.encryptAsymetricKey(
      nodeInfo.encryption_public_key.algorithm,
      nodeInfo.encryption_public_key.public_key,
      encryptionKey
    );

    const encryptedEncryptionKey = {
      encrypted_symmetric_key_base64: encryptedSymKey.toString('base64'),
      encrypted_data_base64: encryptedMessage.toString('base64'),
      encryption_key_version: nodeInfo.encryption_public_key.version,
    };

    const dataForRetryWithoutSignature = {
      encrypted_encryption_key: encryptedEncryptionKey,
      requester_node_id: requesterNodeId,
      signing_key_version: nodeInfo.signing_public_key.version,
    };

    const dataForRetryForSigning = {
      request_id,
      ...dataForRetryWithoutSignature,
    };

    const dataForRetrySignature = await utils.createSignature(
      nodeInfo.signing_public_key.algorithm,
      nodeInfo.signing_public_key.version,
      JSON.stringify(dataForRetryForSigning),
      nodeId
    );

    const dataForRetry = {
      ...dataForRetryWithoutSignature,
      signature: dataForRetrySignature.toString('base64'),
    };

    const dataToSendToRP = {
      request_id,
      as_node_id: nodeId,
      service_id: request.service_id,
      signature,
      data_salt,
      packed_data: encryptedPackedData,
      data_for_retry: dataForRetry,
    };

    const onSendSuccess = async () => {
      // request status update
      // status: "data_decryption_pending"

      await cacheDb.setYourDataCurrentRequestStatus(
        nodeId,
        request.request_id,
        yourDataRequestStatus.DATA_DECRYPTION_PENDING,
        null,
        true
      );

      // callback to AS app
      callbackStatusUpdateDataDecryptionPending({
        nodeId,
        requesterNodeId: request.requester_node_id,
        requestId: request.request_id,
        requestTimeout: request.request_timeout,
      });
    };

    await sendResponseToRequester(
      nodeId,
      requesterNodeId,
      request,
      dataToSendToRP,
      onSendSuccess,
      { apiVersion, ndidMemberAppType, ndidMemberAppVersion }
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot respond data to RP (internal queue)',
      params: respondDataToRPParams,
      cause: error,
    });
  }
}

async function callbackStatusUpdateDataDecryptionPending({
  nodeId,
  requesterNodeId,
  requestId,
  requestTimeout,
}) {
  const callbackUrl = await getIncomingRequestStatusUpdateCallbackUrl();
  if (callbackUrl != null) {
    const eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.request_status',
      requester_node_id: requesterNodeId,
      as_node_id: nodeId,
      request_id: requestId,
      request_timeout: requestTimeout,
      timed_out: false,
      status: yourDataRequestStatus.DATA_DECRYPTION_PENDING,
    };

    await callbackToClient({
      getCallbackUrlFnName:
        'yourdata.as.getIncomingRequestStatusUpdateCallbackUrl',
      body: eventDataForCallback,
      retry: true,
    });
  }
}

export async function respondErrorToRP(
  respondErrorToRPParams,
  { apiVersion, ndidMemberAppType, ndidMemberAppVersion } = {},
  otherParams = {}
) {
  let { node_id: nodeId } = respondErrorToRPParams;
  const { request_id, error_code } = respondErrorToRPParams;

  if (role === 'proxy') {
    if (nodeId == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    nodeId = config.nodeId;
  }

  try {
    const errorCodeList = await tendermintNdid.getDomainErrorCodeList({
      domain: domain.YOURDATA,
      type: 'as',
    });
    if (
      errorCodeList.find((error) => error.error_code === error_code) == null
    ) {
      throw new CustomError({
        errorType: errorType.INVALID_ERROR_CODE,
        details: {
          as_error_code: error_code,
        },
      });
    }

    await yourDataRequestQueueManager.enqueue(
      nodeId,
      request_id,
      respondErrorToRPInternal,
      {
        ...respondErrorToRPParams,
        node_id: nodeId,
      },
      { apiVersion, ndidMemberAppType, ndidMemberAppVersion },
      otherParams
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot respond error to RP',
      params: respondErrorToRPParams,
      cause: error,
    });
  }
}

// use this function with request process queue
// to prevent some inconsistencies with status change
// e.g. AS app call send data API multiple times, timeout status sync from RP happening at the same time
async function respondErrorToRPInternal(
  respondErrorToRPParams,
  { apiVersion, ndidMemberAppType, ndidMemberAppVersion } = {},
  {
    request, // for bypassing request check in cache
  } = {}
) {
  let { node_id: nodeId } = respondErrorToRPParams;
  const { request_id, error_code, error_message } = respondErrorToRPParams;

  try {
    if (request == null) {
      // check request is still active / not timed out yet
      // -> get request data from cache if not exist assume timed out
      request = await cacheDb.getYourDataRequestData(nodeId, request_id);
      if (request == null) {
        throw new CustomError({
          errorType: errorType.REQUEST_IS_TIMED_OUT_OR_NOT_EXIST,
        });
      }

      // get request status and check state. If at wrong state, return error
      const currentRequestStatus =
        await cacheDb.getYourDataCurrentRequestStatus(nodeId, request_id);
      if (currentRequestStatus !== yourDataRequestStatus.PENDING) {
        throw new CustomError({
          errorType: errorType.UNEXPECTED_ACTION_AT_CURRENT_REQUEST_STATE,
          details: {
            currentRequestStatus,
          },
        });
      }
    }

    // check if request is not yet timed out
    const requestTimeoutMsec = request.request_timeout * 1000;
    const requestTimeoutAt = request.request_time + requestTimeoutMsec;
    const timedout = Date.now() > requestTimeoutAt;
    if (timedout) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_TIMED_OUT,
        details: {
          requestId: request_id,
        },
      });
    }

    const requesterNodeId = request.requester_node_id;
    const dataToSendToRP = {
      request_id,
      as_node_id: nodeId,
      service_id: request.service_id,
      error_code,
      error_message,
    };

    const onSendSuccess = async () => {
      // request status update
      // status: "errored"

      // request's final state

      // cleanup
      await Promise.all([
        cacheDb.removeYourDataRequestData(nodeId, request.request_id),
        cacheDb.removeYourDataCurrentRequestStatus(nodeId, request.request_id),
      ]);

      // callback to AS app
      callbackStatusUpdateErrored({
        nodeId,
        requesterNodeId: request.requester_node_id,
        requestId: request.request_id,
        requestTimeout: request.request_timeout,
        errorCode: error_code,
        errorMessage: error_message,
      });
    };

    await sendResponseToRequester(
      nodeId,
      requesterNodeId,
      request,
      dataToSendToRP,
      onSendSuccess,
      { apiVersion, ndidMemberAppType, ndidMemberAppVersion }
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot respond error to RP (internal queue)',
      params: respondErrorToRPParams,
      cause: error,
    });
  }
}

async function callbackStatusUpdateErrored({
  nodeId,
  requesterNodeId,
  requestId,
  requestTimeout,
  errorCode,
  errorMessage,
}) {
  const callbackUrl = await getIncomingRequestStatusUpdateCallbackUrl();
  if (callbackUrl != null) {
    const eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.request_status',
      requester_node_id: requesterNodeId,
      as_node_id: nodeId,
      request_id: requestId,
      request_timeout: requestTimeout,
      timed_out: false,
      status: yourDataRequestStatus.ERRORED,
      error_code: errorCode,
      error_message: errorMessage,
    };

    await callbackToClient({
      getCallbackUrlFnName:
        'yourdata.as.getIncomingRequestStatusUpdateCallbackUrl',
      body: eventDataForCallback,
      retry: true,
    });
  }
}

async function sendResponseToRequester(
  nodeId,
  requesterNodeId,
  request,
  data,
  onSendSuccess,
  { apiVersion, ndidMemberAppType, ndidMemberAppVersion } = {}
) {
  const nodeInfo = await tendermintNdid.getNodeInfo(requesterNodeId);
  if (nodeInfo == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: {
        request_id: data.request_id,
      },
    });
  }

  let receivers;
  if (nodeInfo.proxy != null) {
    if (nodeInfo.proxy.mq == null || nodeInfo.proxy.mq.length === 0) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id: data.request_id,
          nodeId: requesterNodeId,
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
          request_id: data.request_id,
          nodeId: requesterNodeId,
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
      type: privateMessageType.YOURDATA_AS_RESPONSE,
      request_id: data.request_id,
      as_node_id: data.as_node_id,
      service_id: data.service_id,
      signature: data.signature,
      data_salt: data.data_salt,
      packed_data: data.packed_data,
      data_for_retry: data.data_for_retry,
      error_code: data.error_code,
      error_message: data.error_message,
    },
    senderNodeId: nodeId,
    onSuccess: ({ mqDestAddress, receiverNodeId }) => {
      onSendSuccess();

      nodeCallback.notifyMessageQueueSuccessSend({
        nodeId,
        getCallbackUrlFnName:
          'nodeCallback.getMessageQueueSendSuccessCallbackUrl',
        destNodeId: receiverNodeId,
        destIp: mqDestAddress.ip,
        destPort: mqDestAddress.port,
        requestId: data.request_id,
      });
    },
  });

  TelemetryLogger.logYourDataRequestEvent(
    data.request_id,
    nodeId,
    YOURDATA_REQUEST_EVENTS.AS_SENDS_RESPONSE,
    {
      api_spec_version: apiVersion,
      ndid_member_app_type: ndidMemberAppType,
      ndid_member_app_version: ndidMemberAppVersion,
      source_request_id_list: request.tokenPayload.sourceRequestIdList,
      service_id: data.service_id,
      requester_node_id: requesterNodeId,
      error_code: data.error_code,
      error_message: data.error_message,
    }
  );
}
