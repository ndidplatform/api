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

import { cleanupRequestCachedData } from '.';
import { cleanupDataDecryptionKeyRetryRequestCachedData } from './data_decryption_key_retry_request';

import yourDataRequestStatus, {
  dataDecryptionKeyRetryRequestStatus,
} from '../request_status';

import * as common from '../../common';
import { unpackData } from '../../as_data_helper';
import * as nodeCallback from '../../node_callback';

import * as tendermintNdid from '../../../tendermint/ndid';
import * as cacheDb from '../../../db/cache';
import { callbackToClient } from '../../../callback';
import * as mq from '../../../mq';
import privateMessageType from '../../../mq/message/type';
import * as utils from '../../../utils';
import * as cryptoUtils from '../../../utils/crypto';
import TelemetryLogger, { YOURDATA_REQUEST_EVENTS } from '../../../telemetry';
import logger from '../../../logger';

import * as config from '../../../config';
import * as testConfig from '../../../test_config';

export async function processMessage(nodeId, messageId, message) {
  const requestId = message.request_id;
  logger.debug({
    message: 'Processing YourData message',
    nodeId,
    messageId,
    requestId,
  });

  try {
    if (message.type === privateMessageType.YOURDATA_AS_RESPONSE) {
      await processASResponse(nodeId, message);
    } else if (
      message.type === privateMessageType.YOURDATA_DATA_DECRYPTION_KEY_RESPONSE
    ) {
      await processDataDecryptionKeyResponse(nodeId, message);
    } else if (
      message.type ===
      privateMessageType.YOURDATA_DATA_DECRYPTION_KEY_RETRY_RESPONSE
    ) {
      await processDataDecryptionKeyRetryResponse(nodeId, message);
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
      getCallbackUrlFnName: 'rp.getErrorCallbackUrl',
      action: 'yourdata.rp.processMessage',
      error: err,
      requestId,
    });
    throw err;
  }
}

async function processASResponse(nodeId, message) {
  const {
    request_id,
    as_node_id,
    service_id,
    signature,
    data_salt,
    packed_data,
    data_for_retry,
    error_code,
    error_message,
  } = message;

  logger.info({
    message: 'Processing AS response',
    requestId: request_id,
  });

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
  // 1. encrypted data
  // 2. error

  const currentRequestStatus = await cacheDb.getYourDataCurrentRequestStatus(
    nodeId,
    request_id
  );

  if (currentRequestStatus !== yourDataRequestStatus.PENDING) {
    logger.info({
      message: 'Unexpected action at current request state. Discarding.',
      requestId: request_id,
      currentRequestStatus,
    });
    return;
  }

  if (error_code != null) {
    // request status update
    // status: "error"

    // request's final state
    // stop timeout timer
    common.removeTimeoutScheduler(nodeId, request_id);

    // callback to RP app
    const eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.request_status',
      requester_node_id: nodeId,
      as_node_id: request.as_node_id,
      request_id,
      request_timeout: request.request_timeout,
      timed_out: false,
      status: yourDataRequestStatus.ERRORED,
      error_code,
      error_message,
    };

    const callbackUrl = request.callback_url;
    await callbackToClient({
      callbackUrl,
      body: eventDataForCallback,
      retry: true,
    });

    // request's final state
    // remove request data from cache
    await cleanupRequestCachedData({
      nodeId,
      requestId: request_id,
      referenceId: request.reference_id,
    });
  } else {
    // request status update
    // status: "data_decryption_pending"

    await cacheDb.setYourDataCurrentRequestStatus(
      nodeId,
      request_id,
      yourDataRequestStatus.DATA_DECRYPTION_PENDING,
      null,
      true
    );

    // callback to RP app
    let eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.request_status',
      requester_node_id: nodeId,
      as_node_id: request.as_node_id,
      request_id,
      request_timeout: request.request_timeout,
      timed_out: false,
      status: yourDataRequestStatus.DATA_DECRYPTION_PENDING,
    };

    let callbackUrl = request.callback_url;
    await callbackToClient({
      callbackUrl,
      body: eventDataForCallback,
      retry: true,
    });

    //

    // save encrypted data to cache
    await cacheDb.setYourDataEncryptedData(nodeId, request_id, {
      as_node_id: request.as_node_id,
      service_id,
      signature,
      data_salt,
      packed_data,
      data_for_retry,
    });

    // FOR TESTING ONLY
    // stop processing here (don't request for data decryption key), to test data decryption key retry request
    if (testConfig.getDoNotRequestForYourDataDataDecryptionKeyConfig()) {
      return;
    }

    const encryptedPackedDataBuffer = Buffer.from(
      packed_data.buffer_base64,
      'base64'
    );

    const encryptDataHashBase64 = utils.hash(
      cryptoUtils.hashAlgorithm.SHA256,
      encryptedPackedDataBuffer
    );

    // send data encryption key request to AS
    const asNodeId = request.as_node_id;

    const nodeInfo = await tendermintNdid.getNodeInfo(asNodeId);
    if (nodeInfo == null) {
      throw new CustomError({
        errorType: errorType.NODE_INFO_NOT_FOUND,
        details: {
          request_id,
          as_node_id: asNodeId,
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
            as_node_id: asNodeId,
          },
        });
      }
      receivers = [
        {
          node_id: asNodeId,
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
            as_node_id: asNodeId,
          },
        });
      }
      receivers = [
        {
          node_id: asNodeId,
          encryption_public_key: nodeInfo.encryption_public_key,
          ip: nodeInfo.mq[0].ip,
          port: nodeInfo.mq[0].port,
        },
      ];
    }

    await mq.send({
      receivers,
      message: {
        type: privateMessageType.YOURDATA_DATA_DECRYPTION_KEY_REQUEST,
        request_id,
        service_id,
        rp_node_id: nodeId,
        encrypted_data_hash_base64: encryptDataHashBase64, // SHA256 hash
      },
      senderNodeId: nodeId,
      onSuccess: async ({ mqDestAddress, receiverNodeId }) => {
        // request status update
        // status: "data_decryption_key_requested"

        await cacheDb.setYourDataCurrentRequestStatus(
          nodeId,
          request_id,
          yourDataRequestStatus.DATA_DECRYPTION_KEY_REQUESTED,
          null,
          true
        );

        // callback to RP app
        eventDataForCallback = {
          node_id: nodeId,
          type: 'yourdata.request_status',
          requester_node_id: nodeId,
          as_node_id: request.as_node_id,
          request_id,
          request_timeout: request.request_timeout,
          timed_out: false,
          status: yourDataRequestStatus.DATA_DECRYPTION_KEY_REQUESTED,
        };

        callbackUrl = request.callback_url;
        await callbackToClient({
          callbackUrl,
          body: eventDataForCallback,
          retry: true,
        });

        //

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

    TelemetryLogger.logYourDataRequestEvent(
      request_id,
      nodeId,
      YOURDATA_REQUEST_EVENTS.RP_REQUESTS_DATA_DECRYPTION_KEY,
      {
        source_request_id_list: request.tokenPayload.sourceRequestIdList,
        service_id,
        as_node_id: asNodeId,
      }
    );
  }
}

async function processDataDecryptionKeyResponse(nodeId, message) {
  const { request_id, key_base64 } = message;

  logger.info({
    message: 'Processing data decryption key response',
    requestId: request_id,
  });

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

  // request status update
  // status: "data_decryption_key_available"

  await cacheDb.setYourDataCurrentRequestStatus(
    nodeId,
    request_id,
    yourDataRequestStatus.DATA_DECRYPTION_KEY_AVAILABLE,
    null,
    true
  );

  // callback to RP app
  let eventDataForCallback = {
    node_id: nodeId,
    type: 'yourdata.request_status',
    requester_node_id: nodeId,
    as_node_id: request.as_node_id,
    request_id,
    request_timeout: request.request_timeout,
    timed_out: false,
    status: yourDataRequestStatus.DATA_DECRYPTION_KEY_AVAILABLE,
  };

  let callbackUrl = request.callback_url;
  await callbackToClient({
    callbackUrl,
    body: eventDataForCallback,
    retry: true,
  });

  //

  // get encrypted data and signature received from AS from cache
  const encryptedDataFromAS = await cacheDb.getYourDataEncryptedData(
    nodeId,
    request_id
  );

  // decrypt data with key from AS
  const key = Buffer.from(key_base64, 'base64');
  const encryptedPackedDataBuffer = Buffer.from(
    encryptedDataFromAS.packed_data.buffer_base64,
    'base64'
  );
  const decryptedDataBuffer = cryptoUtils.decryptAES256GCM(
    key,
    encryptedPackedDataBuffer,
    false
  );

  const packedData = {
    buffer_base64: decryptedDataBuffer.toString('base64'),
    metadata: encryptedDataFromAS.packed_data.metadata,
  };

  const data = await unpackData({
    packedData,
    maxUncompressedLength: config.asDataMaxUncompressedLength,
  });

  // verify signature
  const signature = encryptedDataFromAS.signature;
  const dataSalt = encryptedDataFromAS.data_salt;

  const dataSignatureVerificationResult = await verifyDataSignature(
    request.as_node_id,
    signature,
    dataSalt,
    data
  );
  if (!dataSignatureVerificationResult.valid) {
    const err = new CustomError({
      errorType: errorType.INVALID_DATA_RESPONSE_SIGNATURE,
      details: {
        request_id,
      },
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'rp.getErrorCallbackUrl',
      action: 'yourdata.processDataDecryptionKeyResponse',
      error: err,
      requestId: request_id,
    });
    return;
  }

  // set/store decrypted data to cache
  await cacheDb.setYourDataDataFromAS(nodeId, request_id, {
    source_node_id: request.as_node_id,
    service_id: request.service_id,
    source_signature: signature,
    signature_signing_algorithm:
      dataSignatureVerificationResult.signingPublicKey.algorithm,
    signature_signing_key_version:
      dataSignatureVerificationResult.signingPublicKey.version,
    data_salt: dataSalt,
    data,
  });

  await cacheDb.removeYourDataEncryptedData(nodeId, request_id);

  // request's final state
  // stop timeout timer
  common.removeTimeoutScheduler(nodeId, request_id);

  //

  // request status update
  // status: "completed"

  // callback to RP app
  eventDataForCallback = {
    node_id: nodeId,
    type: 'yourdata.request_status',
    requester_node_id: nodeId,
    as_node_id: request.as_node_id,
    request_id,
    request_timeout: request.request_timeout,
    timed_out: false,
    status: yourDataRequestStatus.COMPLETED,
  };

  callbackUrl = request.callback_url;
  await callbackToClient({
    callbackUrl,
    body: eventDataForCallback,
    retry: true,
  });

  // request's final state
  // remove request data from cache
  await cleanupRequestCachedData({
    nodeId,
    requestId: request_id,
    referenceId: request.reference_id,
  });

  // send request status sync to AS
  const asNodeId = request.as_node_id;

  const nodeInfo = await tendermintNdid.getNodeInfo(asNodeId);
  if (nodeInfo == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: {
        request_id,
        as_node_id: asNodeId,
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
          as_node_id: asNodeId,
        },
      });
    }
    receivers = [
      {
        node_id: asNodeId,
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
          as_node_id: asNodeId,
        },
      });
    }
    receivers = [
      {
        node_id: asNodeId,
        encryption_public_key: nodeInfo.encryption_public_key,
        ip: nodeInfo.mq[0].ip,
        port: nodeInfo.mq[0].port,
      },
    ];
  }

  await mq.send({
    receivers,
    message: {
      type: privateMessageType.YOURDATA_STATUS_SYNC,
      request_id,
      rp_node_id: nodeId,
      status: yourDataRequestStatus.COMPLETED,
      timed_out: false,
    },
    senderNodeId: nodeId,
    onSuccess: ({ mqDestAddress, receiverNodeId }) => {
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

async function processDataDecryptionKeyRetryResponse(nodeId, message) {
  const { request_id, key_base64 } = message;

  logger.info({
    message: 'Processing data decryption key retry response',
    requestId: request_id,
  });

  // check request is still active / not timed out yet
  // -> get request data from cache if not exist assume timed out
  const retryRequest = await cacheDb.getYourDataRetryRequestData(
    nodeId,
    request_id
  );
  if (retryRequest == null) {
    logger.info({
      message:
        'Data decryption key retry request is already timed out or does not exist',
      requestId: request_id,
    });
    return;
  }

  // get encrypted data and signature received from AS from cache
  const encryptedDataFromAS = await cacheDb.getYourDataEncryptedData(
    nodeId,
    request_id
  );

  // decrypt data with key from AS
  const key = Buffer.from(key_base64, 'base64');
  const encryptedPackedDataBuffer = Buffer.from(
    encryptedDataFromAS.packed_data.buffer_base64,
    'base64'
  );
  const decryptedDataBuffer = cryptoUtils.decryptAES256GCM(
    key,
    encryptedPackedDataBuffer,
    false
  );

  const packedData = {
    buffer_base64: decryptedDataBuffer.toString('base64'),
    metadata: encryptedDataFromAS.packed_data.metadata,
  };

  const data = await unpackData({
    packedData,
    maxUncompressedLength: config.asDataMaxUncompressedLength,
  });

  // verify signature
  const signature = encryptedDataFromAS.signature;
  const dataSalt = encryptedDataFromAS.data_salt;

  const dataSignatureVerificationResult = await verifyDataSignature(
    retryRequest.as_node_id,
    signature,
    dataSalt,
    data
  );
  if (!dataSignatureVerificationResult.valid) {
    const err = new CustomError({
      errorType: errorType.INVALID_DATA_RESPONSE_SIGNATURE,
      details: {
        request_id,
      },
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'rp.getErrorCallbackUrl',
      action: 'yourdata.processDataDecryptionKeyRetryResponse',
      error: err,
      requestId: request_id,
    });
    return;
  }

  // set/store decrypted data to cache
  await cacheDb.setYourDataDataFromAS(nodeId, request_id, {
    source_node_id: retryRequest.as_node_id,
    service_id: retryRequest.service_id,
    source_signature: signature,
    signature_signing_algorithm:
      dataSignatureVerificationResult.signingPublicKey.algorithm,
    signature_signing_key_version:
      dataSignatureVerificationResult.signingPublicKey.version,
    data_salt: dataSalt,
    data,
  });

  await cacheDb.removeYourDataEncryptedData(nodeId, request_id);

  // stop timeout timer
  common.removeTimeoutScheduler(nodeId, request_id);

  //

  // callback to RP app
  const eventDataForCallback = {
    node_id: nodeId,
    type: 'yourdata.data_decryption_key_retry_request_status',
    requester_node_id: nodeId,
    as_node_id: retryRequest.as_node_id,
    request_id,
    request_timeout: retryRequest.request_timeout,
    timed_out: false,
    status: dataDecryptionKeyRetryRequestStatus.COMPLETED,
  };

  const callbackUrl = retryRequest.callback_url;
  await callbackToClient({
    callbackUrl,
    body: eventDataForCallback,
    retry: true,
  });

  // remove data decryption key retry request data from cache
  await cleanupDataDecryptionKeyRetryRequestCachedData({
    nodeId,
    requestId: request_id,
    referenceId: retryRequest.reference_id,
  });
}

async function verifyDataSignature(asNodeId, signature, salt, data) {
  const signingPublicKey = await tendermintNdid.getNodeSigningPubKey(asNodeId);
  if (signingPublicKey == null) {
    return { valid: false };
  }

  logger.debug({
    message: 'Verifying AS data signature',
    asNodeId,
    asNodePublicKey: signingPublicKey,
    signature,
  });
  logger.trace({
    message: 'Verifying AS data signature',
    asNodeId,
    asNodePublicKey: signingPublicKey,
    signature,
    salt,
    data,
  });
  if (
    !utils.verifySignature(
      signingPublicKey.algorithm,
      signature,
      signingPublicKey.public_key,
      data + salt
    )
  ) {
    logger.warn({
      message: 'Data signature from AS is not valid',
      signature,
      asNodeId,
      asNodePublicKey: signingPublicKey,
    });

    return { valid: false, signingPublicKey };
  }

  return { valid: true, signingPublicKey };
}
