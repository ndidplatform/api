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

import { dataDecryptionKeyRetryRequestStatus } from '../request_status';
import {
  setTimeoutScheduler,
  removeTimeoutScheduler,
} from '../../common/timeout_scheduler';
import * as nodeCallback from '../../node_callback';

import * as tendermintNdid from '../../../tendermint/ndid';
import * as cacheDb from '../../../db/cache';
import * as mq from '../../../mq';
import privateMessageType from '../../../mq/message/type';
import { callbackToClient } from '../../../callback';
import TelemetryLogger, { YOURDATA_REQUEST_EVENTS } from '../../../telemetry';
import logger from '../../../logger';

import * as config from '../../../config';
import { role } from '../../../node';

export async function createDataDecryptionKeyRetryRequest(
  createDataDecryptionKeyRetryRequestParams,
  { apiVersion, ndidMemberAppType, ndidMemberAppVersion } = {}
) {
  let { node_id } = createDataDecryptionKeyRetryRequestParams;
  const { request_id, reference_id, callback_url, request_timeout } =
    createDataDecryptionKeyRetryRequestParams;

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
    // validations

    // request must already timed out / not in progress
    const request = await cacheDb.getYourDataRequestData(node_id, request_id);
    if (request != null) {
      throw new CustomError({
        errorType: errorType.REQUEST_STILL_IN_PROGRESS,
      });
    }

    // has encrypted data from AS / get retry data
    const encryptedDataFromAS = await cacheDb.getYourDataEncryptedData(
      node_id,
      request_id
    );
    if (encryptedDataFromAS == null) {
      throw new CustomError({
        errorType: errorType.ENCRYPTED_DATA_NOT_FOUND,
      });
    }

    // check (active) duplicate reference ID from cache
    const existingRequestId =
      await cacheDb.getYourDataRetryRequestIdByReferenceId(
        node_id,
        reference_id
      );
    if (existingRequestId) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_REFERENCE_ID,
      });
    }

    const {
      as_node_id: asNodeId,
      service_id: serviceId,
      data_for_retry,
    } = encryptedDataFromAS;

    const retryRequestData = {
      as_node_id: asNodeId,
      service_id: serviceId,
      request_timeout,
      reference_id,
      callback_url,
    };

    const retryRequestDataSet = await cacheDb.setYourDataRetryRequestData(
      node_id,
      request_id,
      retryRequestData
    );
    if (!retryRequestDataSet) {
      // there's active/on-going data decryption key retry request
      throw new CustomError({
        errorType: errorType.RETRY_ENCRYPTED_DATA_KEY_REQUEST_IN_PROGRESS,
      });
    }

    await cacheDb.setYourDataRetryRequestIdByReferenceId(
      node_id,
      reference_id,
      request_id
    );

    // set timeout
    await setTimeoutScheduler({
      nodeId: node_id,
      requestId: request_id,
      type: 'yourdata.data_decryption_key_retry_request',
      secondsToTimeout: request_timeout,
    });

    // send request to AS via MQ

    const asNodeInfo = await tendermintNdid.getNodeInfo(asNodeId);
    if (asNodeInfo == null) {
      throw new CustomError({
        errorType: errorType.NODE_INFO_NOT_FOUND,
        details: {
          asNodeId,
        },
      });
    }

    let receivers;
    if (asNodeInfo.proxy != null) {
      if (asNodeInfo.proxy.mq == null || asNodeInfo.proxy.mq.length === 0) {
        throw new CustomError({
          errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
          details: {
            asNodeId,
          },
        });
      }
      receivers = [
        {
          node_id: asNodeId,
          encryption_public_key: asNodeInfo.encryption_public_key,
          proxy: {
            node_id: asNodeInfo.proxy.node_id,
            encryption_public_key: asNodeInfo.proxy.encryption_public_key,
            ip: asNodeInfo.proxy.mq[0].ip,
            port: asNodeInfo.proxy.mq[0].port,
            config: asNodeInfo.proxy.config,
          },
        },
      ];
    } else {
      if (asNodeInfo.mq == null || asNodeInfo.mq.length === 0) {
        throw new CustomError({
          errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
          details: {
            asNodeId,
          },
        });
      }
      receivers = [
        {
          node_id: asNodeId,
          encryption_public_key: asNodeInfo.encryption_public_key,
          ip: asNodeInfo.mq[0].ip,
          port: asNodeInfo.mq[0].port,
        },
      ];
    }

    const mqMessage = {
      type: privateMessageType.YOURDATA_DATA_DECRYPTION_KEY_RETRY_REQUEST,
      request_id,
      service_id: serviceId,
      rp_node_id: node_id,
      data_for_retry,
    };

    await mq.send({
      receivers,
      message: mqMessage,
      senderNodeId: node_id,
      onSuccess: ({ mqDestAddress, receiverNodeId }) => {
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

    TelemetryLogger.logYourDataRequestEvent(
      request_id,
      node_id,
      YOURDATA_REQUEST_EVENTS.RP_REQUESTS_DATA_DECRYPTION_KEY_RETRY,
      {
        api_spec_version: apiVersion,
        ndid_member_app_type: ndidMemberAppType,
        ndid_member_app_version: ndidMemberAppVersion,
        service_id: serviceId,
        as_node_id: asNodeId,
      }
    );

    // callback to RP app
    const eventDataForCallback = {
      node_id,
      type: 'yourdata.data_decryption_key_retry_request_status',
      requester_node_id: node_id,
      as_node_id: asNodeId,
      request_id,
      request_timeout,
      timed_out: false,
      status: dataDecryptionKeyRetryRequestStatus.PENDING,
    };

    await callbackToClient({
      callbackUrl: callback_url,
      body: eventDataForCallback,
      retry: true,
    });
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot retry data decryption key request',
      cause: error,
    });
    logger.error({ err });

    throw err;
  }
}

export async function timeoutDataDecryptionKeyRetryRequest(nodeId, requestId) {
  try {
    const retryRequest = await cacheDb.getYourDataRetryRequestData(
      nodeId,
      requestId
    );
    if (retryRequest == null) {
      throw new CustomError({
        message:
          'Data decryption key retry request is completed or does not exist',
      });
    }

    // stop timeout timer
    removeTimeoutScheduler(nodeId, requestId);

    // callback to RP app
    const eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.data_decryption_key_retry_request_status',
      requester_node_id: nodeId,
      as_node_id: retryRequest.as_node_id,
      request_id: requestId,
      request_timeout: retryRequest.request_timeout,
      timed_out: true,
      status: dataDecryptionKeyRetryRequestStatus.PENDING,
    };

    const callbackUrl = retryRequest.callback_url;
    await callbackToClient({
      callbackUrl,
      body: eventDataForCallback,
      retry: true,
    });

    // remove request data from cache
    await cleanupDataDecryptionKeyRetryRequestCachedData({
      nodeId,
      requestId,
      referenceId: retryRequest.reference_id,
    });
  } catch (error) {
    logger.error({
      message: 'Cannot timeout retry data decryption key request',
      requestId,
      err: error,
    });
    throw error;
  }
}

export async function cleanupDataDecryptionKeyRetryRequestCachedData({
  nodeId,
  requestId,
  referenceId,
}) {
  await Promise.all([
    cacheDb.removeYourDataRetryRequestData(nodeId, requestId),
    cacheDb.removeYourDataRetryRequestIdByReferenceId(nodeId, referenceId),
  ]);
}
