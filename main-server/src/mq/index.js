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

import path from 'path';
import EventEmitter from 'events';

import protobuf from 'protobufjs';

import { serializeMqMessage, deserializeMqMessage } from './message';

import * as mqService from './grpc_client';
import * as tendermint from '../tendermint';
import * as tendermintNdid from '../tendermint/ndid';
import * as cacheDb from '../db/cache';
import * as longTermDb from '../db/long_term';
import * as utils from '../utils';
import * as cryptoUtils from '../utils/crypto';
import logger from '../logger';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import {
  MQ_MESSAGE_VERSION,
  MQ_RECV_DUPLICATE_CHECK_TIMEOUT,
  MQ_SEND_TOTAL_TIMEOUT,
} from './constants';
import validate from './message/validator';

import TelemetryLogger from '../telemetry';

import { delegateToWorker } from '../master-worker-interface/server';

import { role } from '../node';
import MODE from '../mode';
import * as config from '../config';

const mqMessageProtobufRootInstance = new protobuf.Root();
const mqMessageProtobufRoot = mqMessageProtobufRootInstance.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'mq_message.proto'),
  { keepCase: true }
);
const encryptedMqMessageProtobufRootInstance = new protobuf.Root();
const encryptedMqMessageProtobufRoot =
  encryptedMqMessageProtobufRootInstance.loadSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'protos',
      'encrypted_mq_message.proto'
    ),
    { keepCase: true }
  );
const MqMessage = mqMessageProtobufRoot.lookupType('MqMessage');
const EncryptedMqMessage =
  encryptedMqMessageProtobufRoot.lookupType('EncryptedMqMessage');

const prefixMsgId = utils.randomBase64Bytes(8);
let outboundMessageIdCounter = 1;
const pendingOutboundMessages = new Map();
let pendingOutboundMessagesCount = 0;

const timers = new Map();

let messageHandlerFunction;
let errorHandlerFunction;

let telemetryEnabled = false;

export const metricsEventEmitter = new EventEmitter();

export function setMessageHandlerFunction(handler) {
  messageHandlerFunction = handler;
}

export function setErrorHandlerFunction(handler) {
  errorHandlerFunction = handler;
}

async function telemetryLogVersions(version) {
  if (telemetryEnabled) {
    await TelemetryLogger.logMQServiceVersion({
      nodeId: config.nodeId,
      version,
    });
  }
}

export async function initializeOutbound({
  sendSavedPendingMessages = true,
  telemetryEnabled: _telemetryEnabled = false,
} = {}) {
  logger.info({
    message: 'Initializing message queue (outbound)',
  });

  telemetryEnabled = _telemetryEnabled;

  await mqService.initialize({
    telemetryLogVersions,
  });

  if (sendSavedPendingMessages) {
    // Send saved pending outbound messages
    await sendSavedPendingOutboundMessages();
  }

  logger.info({
    message: 'Message queue (outbound) initialized',
  });
}

export async function initializeInbound({
  telemetryEnabled: _telemetryEnabled = false,
} = {}) {
  logger.info({
    message: 'Initializing message queue (inbound)',
  });

  telemetryEnabled = _telemetryEnabled;

  await initDuplicateInboundMessageTimeout();

  await mqService.initialize({
    telemetryLogVersions,
  });

  mqService.eventEmitter.on('message', onMessage);

  mqService.eventEmitter.on('error', (error) => {
    if (errorHandlerFunction) {
      errorHandlerFunction(error);
    } else {
      logger.error({ message: 'MQ Service error', err: error });
    }
  });

  mqService.subscribeToRecvMessages();

  logger.info({
    message: 'Message queue (inbound) initialized',
  });
}

export function initialize({ telemetryEnabled }) {
  return Promise.all([
    initializeOutbound({ telemetryEnabled }),
    initializeInbound({ telemetryEnabled }),
  ]);
}

async function initDuplicateInboundMessageTimeout() {
  const timeoutList = await cacheDb.getAllDuplicateMessageTimeout(
    config.nodeId
  );
  timeoutList.forEach(({ id: srcUniqueMsgId, unixTimeout: timeoutAtMsec }) => {
    if (timeoutAtMsec > Date.now()) {
      const timeoutDurationMsec = timeoutAtMsec - Date.now();
      timers.set(
        srcUniqueMsgId,
        setTimeout(() => {
          // cache DB (redis) has its TTL, manually deleting is not necessary
          // cacheDb.removeDuplicateMessageTimeout(config.nodeId, srcUniqueMsgId);
          timers.delete(srcUniqueMsgId);
        }, timeoutDurationMsec)
      );
    }
  });
}

export async function resumePendingOutboundMessageSendOnWorker(
  destUniqueMsgId
) {
  const data = await cacheDb.getPendingOutboundMessage(
    config.nodeId,
    destUniqueMsgId
  );
  await sendPendingOutboundMessage({ destUniqueMsgId, data });
}

async function sendPendingOutboundMessage({ destUniqueMsgId, data }) {
  const {
    mqDestAddress,
    payloadBuffer: payloadBufferArr,
    senderNodeId,
    receiverNodeId,
    sendTime,
  } = data;
  if (sendTime + MQ_SEND_TOTAL_TIMEOUT > Date.now()) {
    const payloadBuffer = Buffer.from(payloadBufferArr);
    pendingOutboundMessages.set(destUniqueMsgId, {
      mqDestAddress,
      payloadBuffer,
      senderNodeId,
      receiverNodeId,
      sendTime,
    });
    incrementPendingOutboundMessagesCount();
    mqService
      .sendMessage(
        mqDestAddress,
        payloadBuffer,
        destUniqueMsgId,
        senderNodeId,
        receiverNodeId,
        true,
        MQ_SEND_TOTAL_TIMEOUT
      )
      .catch((error) => {
        logger.error({ message: 'Send message failed', err: error });
        metricsEventEmitter.emit('mqSendMessageFail');
      })
      .then(() => {
        // finally
        pendingOutboundMessages.delete(destUniqueMsgId);
        decrementPendingOutboundMessagesCount();
      });
  }
  await cacheDb.removePendingOutboundMessage(config.nodeId, destUniqueMsgId);
}

async function sendSavedPendingOutboundMessages() {
  logger.info({
    message: 'Loading saved pending outbound messages',
  });
  const savedPendingOutboundMessages =
    await cacheDb.getAllPendingOutboundMessages(config.nodeId);
  if (savedPendingOutboundMessages.length > 0) {
    logger.info({
      message: 'Sending saved pending outbound messages',
      savedPendingOutboundMessageCount: savedPendingOutboundMessages.length,
    });
  }
  await Promise.all(
    savedPendingOutboundMessages.map(sendPendingOutboundMessage)
  );
}

async function onMessage({ message, msgId, senderId, sendACKRefId }) {
  logger.info({
    message: 'Received message from message queue',
    msgId,
    senderId,
    messageLength: message.length,
  });

  const timestamp = Date.now();

  const senderNodeId = senderId;
  const messageId = msgId;

  // Check for duplicate messages
  const srcUniqueMsgId = `${senderNodeId}:${messageId}`;
  if (timers.has(srcUniqueMsgId)) {
    // duplicate
    logger.debug({
      message: 'Received duplicate MQ messages',
      senderNodeId,
      messageId,
    });
    return;
  }

  try {
    if (
      tendermint.connected &&
      !tendermint.syncing &&
      cacheDb.getRedisInstance().connected &&
      longTermDb.getRedisInstance().connected
    ) {
      await processRawMessageSwitch(
        msgId,
        message,
        senderId,
        sendACKRefId,
        timestamp
      );
    }
  } catch (error) {
    if (errorHandlerFunction) {
      errorHandlerFunction(error);
    }
  }
}

async function getMessageFromProtobufMessage(messageProtobuf, nodeId) {
  const decodedMessage = EncryptedMqMessage.decode(messageProtobuf);
  const {
    encrypted_symmetric_key: encryptedSymmetricKey,
    encrypted_mq_message: encryptedMqMessage,
  } = decodedMessage;
  let decryptedBuffer;
  const publicKey = await tendermintNdid.getNodeEncryptionPubKey(nodeId);
  try {
    decryptedBuffer = await utils.decryptAsymetricKey(
      nodeId,
      publicKey.algorithm,
      publicKey.version,
      encryptedSymmetricKey,
      encryptedMqMessage
    );
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DECRYPT_MESSAGE_ERROR,
      cause: error,
    });
  }

  const decodedDecryptedMessage = MqMessage.decode(decryptedBuffer);
  return decodedDecryptedMessage;
}

async function processRawMessageSwitch(
  messageId,
  messageProtobuf,
  senderId,
  sendACKRefId,
  timestamp
) {
  if (config.mode === MODE.STANDALONE) {
    const result = await processRawMessage({
      messageId,
      messageProtobuf,
      senderId,
      sendACKRefId,
      timestamp,
    });
    handleProcessedRawMessage(null, result, { messageId });
  } else if (config.mode === MODE.MASTER) {
    delegateToWorker({
      fnName: 'mq.processRawMessage',
      args: { messageId, messageProtobuf, senderId, sendACKRefId, timestamp },
      additionalCallbackArgs: { messageId },
      callback: handleProcessedRawMessage,
    });
  } else {
    throw new Error('Unsupported mode');
  }
}

function handleProcessedRawMessage(
  error,
  processedRawMessage,
  messageMetadata
) {
  if (error) {
    // logger.error()
    if (errorHandlerFunction) {
      errorHandlerFunction(error);
    }
    return;
  }

  if (processedRawMessage == null) {
    return;
  }

  const { message, receiverNodeId, srcUniqueMsgId, timeoutAtMsec } =
    processedRawMessage;
  const { messageId } = messageMetadata;

  const timeoutDurationMsec = timeoutAtMsec - Date.now();
  if (timeoutDurationMsec > 0) {
    timers.set(
      srcUniqueMsgId,
      setTimeout(() => {
        // cache DB (redis) has its TTL, manually deleting is not necessary
        // cacheDb.removeDuplicateMessageTimeout(config.nodeId, srcUniqueMsgId);
        timers.delete(srcUniqueMsgId);
      }, timeoutDurationMsec)
    );
  }

  if (messageHandlerFunction) {
    messageHandlerFunction(messageId, message, receiverNodeId);
  } else {
    logger.warn({
      message: 'No registered "messageHandlerFunction" function',
    });
  }
}

export async function processRawMessage({
  messageId,
  messageProtobuf,
  senderId,
  sendACKRefId,
  timestamp,
}) {
  logger.info({
    message: 'Processing raw received message from message queue',
    messageId,
    messageLength: messageProtobuf.length,
  });

  let shouldACK = false;

  try {
    const outerLayerDecodedDecryptedMessage =
      await getMessageFromProtobufMessage(messageProtobuf, config.nodeId);

    logger.debug({
      message: 'Decrypted message from message queue',
      outerLayerDecodedDecryptedMessage,
    });

    if (outerLayerDecodedDecryptedMessage.version !== MQ_MESSAGE_VERSION) {
      shouldACK = true;
      throw new CustomError({
        errorType: errorType.MQ_MESSAGE_VERSION_MISMATCH,
        details: {
          expected: MQ_MESSAGE_VERSION,
          got: outerLayerDecodedDecryptedMessage.version,
        },
      });
    }

    let mqMessageVersion;
    let msgId; // in payload
    let messageType;
    let messageBuffer;
    let messageSignature;
    let senderNodeId; // actual sender node ID (not proxy)
    let receiverNodeId;
    let signatureForProxy;
    let messageCompressionAlgorithm;

    if (role === 'proxy') {
      const outerMqMessageVersion = outerLayerDecodedDecryptedMessage.version;

      // Message is encapsulated with proxy layer
      const proxyDecodedDecryptedMessage =
        outerLayerDecodedDecryptedMessage.message;

      // Verify signature
      const proxyMessageHashBase64 = utils.hash(
        cryptoUtils.hashAlgorithm.SHA256,
        proxyDecodedDecryptedMessage
      );
      const firstTierSenderNodeId =
        outerLayerDecodedDecryptedMessage.sender_node_id;
      signatureForProxy = outerLayerDecodedDecryptedMessage.signature;
      receiverNodeId = outerLayerDecodedDecryptedMessage.receiver_node_id;
      if (
        receiverNodeId == null ||
        receiverNodeId === '' ||
        firstTierSenderNodeId == null ||
        firstTierSenderNodeId === ''
      ) {
        shouldACK = true;
        throw new CustomError({
          errorType: errorType.MALFORMED_MESSAGE_FORMAT,
        });
      }

      const messageToVerify = Buffer.concat([
        Buffer.from(outerMqMessageVersion.toString(), 'utf8'),
        Buffer.from(receiverNodeId, 'utf8'),
        Buffer.from(firstTierSenderNodeId, 'utf8'),
        Buffer.from(proxyMessageHashBase64, 'base64'),
      ]);

      const firstTierSenderPublicKey = await tendermintNdid.getNodeSigningPubKey(
        firstTierSenderNodeId
      );

      const signatureValid = utils.verifySignature(
        firstTierSenderPublicKey.algorithm,
        signatureForProxy,
        firstTierSenderPublicKey.public_key,
        messageToVerify
      );

      if (!signatureValid) {
        shouldACK = true;
        throw new CustomError({
          errorType: errorType.INVALID_MESSAGE_SIGNATURE,
        });
      }

      const decodedDecryptedMessage = await getMessageFromProtobufMessage(
        proxyDecodedDecryptedMessage,
        receiverNodeId
      );

      logger.debug({
        message: 'Decrypted message from message queue (inner layer)',
        decodedDecryptedMessage,
      });

      if (decodedDecryptedMessage.version !== MQ_MESSAGE_VERSION) {
        shouldACK = true;
        throw new CustomError({
          errorType: errorType.MQ_MESSAGE_VERSION_MISMATCH,
          details: {
            expected: MQ_MESSAGE_VERSION,
            got: decodedDecryptedMessage.version,
          },
        });
      }

      senderNodeId = decodedDecryptedMessage.sender_node_id;
      mqMessageVersion = decodedDecryptedMessage.version;
      msgId = decodedDecryptedMessage.message_id;
      messageType = decodedDecryptedMessage.message_type;
      messageBuffer = decodedDecryptedMessage.message;
      messageSignature = decodedDecryptedMessage.signature;
      messageCompressionAlgorithm =
        decodedDecryptedMessage.message_compression_algorithm;
    } else {
      senderNodeId = outerLayerDecodedDecryptedMessage.sender_node_id;
      receiverNodeId = config.nodeId;
      mqMessageVersion = outerLayerDecodedDecryptedMessage.version;
      msgId = outerLayerDecodedDecryptedMessage.message_id;
      messageType = outerLayerDecodedDecryptedMessage.message_type;
      messageBuffer = outerLayerDecodedDecryptedMessage.message;
      messageSignature = outerLayerDecodedDecryptedMessage.signature;
      messageCompressionAlgorithm =
        outerLayerDecodedDecryptedMessage.message_compression_algorithm;
    }

    const expectedDestUniqueMsgId = `${msgId}:${receiverNodeId}`;
    if (messageId !== expectedDestUniqueMsgId) {
      shouldACK = true;
      throw new CustomError({
        errorType: errorType.MESSAGE_ID_MISMATCH,
        details: {
          messageId,
          expectedDestUniqueMsgId,
        },
      });
    }

    if (senderNodeId == null) {
      shouldACK = true;
      throw new CustomError({
        errorType: errorType.MESSAGE_FROM_UNKNOWN_NODE,
      });
    }

    if (senderNodeId !== senderId) {
      shouldACK = true;
      throw new CustomError({
        errorType: errorType.MESSAGE_SENDER_MISMATCH,
        details: {
          senderNodeId,
          senderId,
        },
      });
    }

    if (messageBuffer == null || messageSignature == null) {
      shouldACK = true;
      throw new CustomError({
        errorType: errorType.MALFORMED_MESSAGE_FORMAT,
      });
    }

    const message = await deserializeMqMessage(
      messageType,
      messageBuffer,
      messageCompressionAlgorithm
    );

    const { idp_id, rp_id, rp_node_id, as_id, as_node_id } = message;
    const senderNodeIdInMessage =
      idp_id || rp_id || rp_node_id || as_id || as_node_id;
    if (senderNodeId !== senderNodeIdInMessage) {
      shouldACK = true;
      throw new CustomError({
        errorType: errorType.MESSAGE_SENDER_MISMATCH,
        details: {
          senderNodeId,
          senderNodeIdInMessage,
        },
      });
    }

    const nodeInfo = await tendermintNdid.getNodeInfo(senderNodeId);
    const signingPublicKey = nodeInfo.signing_public_key;

    const messageToVerify = Buffer.concat([
      Buffer.from(msgId, 'utf8'),
      Buffer.from(mqMessageVersion.toString(), 'utf8'),
      Buffer.from(senderNodeId, 'utf8'),
      Buffer.from(messageType, 'utf8'),
      messageBuffer,
    ]);

    const signatureValid = utils.verifySignature(
      signingPublicKey.algorithm,
      messageSignature,
      signingPublicKey.public_key,
      messageToVerify
    );

    logger.debug({
      message: 'Verifying signature',
      messageBuffer,
      messageSignature,
      senderNodeId,
      signingPublicKey,
      signatureValid,
    });

    if (!signatureValid) {
      shouldACK = true;
      throw new CustomError({
        errorType: errorType.INVALID_MESSAGE_SIGNATURE,
      });
    }

    // Check for duplicate messages
    const srcUniqueMsgId = `${senderNodeId}:${messageId}`;
    const timeoutAtMsec = timestamp + MQ_RECV_DUPLICATE_CHECK_TIMEOUT;
    const ttlSeconds = Math.floor((timeoutAtMsec - Date.now()) / 1000);
    if (ttlSeconds > 0) {
      const set = await cacheDb.setDuplicateMessageTimeout(
        config.nodeId,
        srcUniqueMsgId,
        timeoutAtMsec,
        ttlSeconds
      );
      if (!set) {
        // duplicate
        logger.debug({
          message: 'Received duplicate MQ messages (in cache DB)',
          senderNodeId,
          messageId,
        });
        return null;
      }
    }

    const validationResult = validate({ type: message.type, message });
    if (!validationResult.valid) {
      shouldACK = true;
      throw new CustomError({
        errorType: errorType.INVALID_MESSAGE_SCHEMA,
        details: {
          fromNodeId: senderNodeId,
          validationResult,
        },
      });
    }

    const source =
      nodeInfo.proxy != null
        ? {
            node_id: senderNodeId,
            proxy_node_id: nodeInfo.proxy.node_id,
            proxy_config: nodeInfo.proxy.config,
          }
        : {
            node_id: senderNodeId,
          };
    await longTermDb.addMessage(
      receiverNodeId,
      longTermDb.MESSAGE_DIRECTIONS.INBOUND,
      message.type,
      message.request_id,
      {
        message,
        direction: longTermDb.MESSAGE_DIRECTIONS.INBOUND,
        source,
        signature: messageSignature.toString('base64'),
        signature_for_proxy:
          signatureForProxy != null
            ? signatureForProxy.toString('base64')
            : undefined,
        timestamp,
      }
    );

    shouldACK = true;
    return {
      message,
      receiverNodeId,
      srcUniqueMsgId,
      timeoutAtMsec,
    };
  } catch (error) {
    logger.warn({
      message:
        'Error processing received message from message queue. Discarding message.',
      err: error,
    });
    throw error;
  } finally {
    if (shouldACK) {
      logger.debug({
        message: 'Sending ACK for received MQ message',
        sendACKRefId,
      });
      mqService.sendAckForRecvMessage(sendACKRefId).catch((error) =>
        logger.error({
          message: 'Send ACK for received message failed',
          err: error,
        })
      );
    }
  }
}

/**
 * @typedef {Object} ProxyReceiver
 * @property {string} node_id
 * @property {Object} encryption_public_key
 * @property {string} ip
 * @property {number} port
 * @property {string} config
 */

/**
 * @typedef {Object} Receiver
 * @property {string} node_id
 * @property {Object} encryption_public_key
 * @property {string} [ip] - Optional if node is behind proxy
 * @property {number} [port] - Optional if node is behind proxy
 * @property {ProxyReceiver} [proxy] - Proxy receiver configuration.
 */

/**
 * @typedef {Object} SendOptions
 * @property {Receiver[]} receivers - The list of intended recipients.
 * @property {Object} message - The payload being transmitted.
 * @property {string} senderNodeId
 * @property {Function} [onSuccess] - Optional callback triggered upon success.
 */

/**
 * Sends a message to multiple receivers through P2P/MQ.
 *
 * @param {SendOptions} options
 * @returns {Promise<void>}
 */
export async function send({ receivers, message, senderNodeId, onSuccess }) {
  if (receivers.length === 0) {
    logger.debug({
      message: 'No receivers for message queue to send to',
      receivers,
      payload: message,
    });
    return;
  }
  const timestamp = Date.now();

  const mqMessageVersion = MQ_MESSAGE_VERSION;

  const { messageType, messageBuffer, messageCompressionAlgorithm } =
    await serializeMqMessage(
      message,
      config.compressMqMessage,
      config.mqMessageCompressMinLength,
      config.mqMessageMaxLength
    );
  const senderPublicKey =
    await tendermintNdid.getNodeSigningPubKey(senderNodeId);
  const msgId = `${prefixMsgId}_${outboundMessageIdCounter++}`;

  const messageToSign = Buffer.concat([
    Buffer.from(msgId, 'utf8'),
    Buffer.from(mqMessageVersion.toString(), 'utf8'),
    Buffer.from(senderNodeId, 'utf8'),
    Buffer.from(messageType, 'utf8'),
    messageBuffer,
  ]);
  const messageSignatureBuffer = await utils.createSignature(
    senderPublicKey.algorithm,
    senderPublicKey.version,
    messageToSign,
    senderNodeId
  );
  const mqMessageObject = {
    version: mqMessageVersion,
    message_id: msgId,
    message_type: messageType,
    message: messageBuffer,
    signature: messageSignatureBuffer,
    sender_node_id: senderNodeId,
    message_compression_algorithm: messageCompressionAlgorithm,
  };
  const protoMessage = MqMessage.create(mqMessageObject);
  const protoBuffer = MqMessage.encode(protoMessage).finish();

  logger.info({
    message: 'Sending message over message queue',
    payloadLength: protoBuffer.length,
    receivers,
  });
  logger.debug({
    message: 'Sending message over message queue details',
    messageObject: message,
    messageSignatureBuffer,
    messageCompressionAlgorithm,
    protoBuffer,
  });

  let senderProxyNodeId;
  if (role === 'proxy') {
    senderProxyNodeId = config.nodeId;
  }

  await Promise.all(
    receivers.map(async (receiver) => {
      const { encryptedSymKey, encryptedMessage } = utils.encryptAsymetricKey(
        receiver.encryption_public_key.algorithm,
        receiver.encryption_public_key.public_key,
        protoBuffer
      );

      const encryptedMqMessageObject = {
        encrypted_symmetric_key: encryptedSymKey,
        encrypted_mq_message: encryptedMessage,
      };
      const protoEncryptedMessage = EncryptedMqMessage.create(
        encryptedMqMessageObject
      );
      const protoEncryptedBuffer = EncryptedMqMessage.encode(
        protoEncryptedMessage
      ).finish();

      const receiverNodeId = receiver.node_id; // actual receiver node ID (not proxy)

      let mqDestAddress;
      let payloadBuffer;
      let firstTierReceiverNodeId; // can be proxy
      let receiverProxyNodeId;
      if (receiver.proxy != null) {
        // Encapsulate proxy layer
        const proxyMessageHashBase64 = utils.hash(
          cryptoUtils.hashAlgorithm.SHA256,
          protoEncryptedBuffer
        );
        const firstTierSenderNodeId = config.nodeId;
        const senderPublicKey = await tendermintNdid.getNodeSigningPubKey(
          firstTierSenderNodeId
        );
        const messageToSign = Buffer.concat([
          Buffer.from(mqMessageVersion.toString(), 'utf8'),
          Buffer.from(receiverNodeId, 'utf8'),
          Buffer.from(firstTierSenderNodeId, 'utf8'),
          Buffer.from(proxyMessageHashBase64, 'base64'),
        ]);
        const proxySignatureBuffer = await utils.createSignature(
          senderPublicKey.algorithm,
          senderPublicKey.version,
          messageToSign,
          firstTierSenderNodeId
        );

        const proxyMqMessageObject = {
          version: mqMessageVersion,
          message: protoEncryptedBuffer,
          signature: proxySignatureBuffer,
          receiver_node_id: receiverNodeId,
          sender_node_id: firstTierSenderNodeId,
        };
        const proxyProtoMessage = MqMessage.create(proxyMqMessageObject);
        const proxyProtoBuffer = MqMessage.encode(proxyProtoMessage).finish();

        const {
          encryptedSymKey: proxyEncryptedSymmetricKey,
          encryptedMessage: proxyEncryptedMqMessage,
        } = utils.encryptAsymetricKey(
          receiver.proxy.encryption_public_key.algorithm,
          receiver.proxy.encryption_public_key.public_key,
          proxyProtoBuffer
        );

        const proxyEncryptedMqMessageObject = {
          encrypted_symmetric_key: proxyEncryptedSymmetricKey,
          encrypted_mq_message: proxyEncryptedMqMessage,
        };
        const proxyProtoEncryptedMessage = EncryptedMqMessage.create(
          proxyEncryptedMqMessageObject
        );
        const proxyProtoEncryptedBuffer = EncryptedMqMessage.encode(
          proxyProtoEncryptedMessage
        ).finish();

        payloadBuffer = proxyProtoEncryptedBuffer;
        mqDestAddress = {
          ip: receiver.proxy.ip,
          port: receiver.proxy.port,
        };
        firstTierReceiverNodeId = receiver.proxy.node_id;
        receiverProxyNodeId = receiver.proxy.node_id;
      } else {
        payloadBuffer = protoEncryptedBuffer;
        mqDestAddress = {
          ip: receiver.ip,
          port: receiver.port,
        };
        firstTierReceiverNodeId = receiver.node_id;
      }

      const destUniqueMsgId = `${msgId}:${receiverNodeId}`;
      pendingOutboundMessages.set(destUniqueMsgId, {
        mqDestAddress,
        payloadBuffer,
        senderNodeId,
        receiverNodeId,
        sendTime: Date.now(),
      });
      incrementPendingOutboundMessagesCount();

      logger.debug({
        message: 'Sending message to message queue service server',
        msgId,
        senderNodeId,
        receiverNodeId,
        senderProxyNodeId,
        receiverProxyNodeId,
        firstTierReceiverNodeId,
        mqDestAddress,
      });
      mqService
        .sendMessage(
          mqDestAddress,
          payloadBuffer,
          destUniqueMsgId,
          senderNodeId,
          receiverNodeId,
          senderProxyNodeId,
          receiverProxyNodeId,
          true,
          MQ_SEND_TOTAL_TIMEOUT
        )
        .then(() => {
          onSuccess?.({
            msgId,
            mqDestAddress,
            senderNodeId,
            receiverNodeId,
          });
          metricsEventEmitter.emit(
            'mqSendMessageTime',
            Date.now() - pendingOutboundMessages.get(destUniqueMsgId).sendTime
          );
        })
        .catch((error) => {
          logger.error({ message: 'Send message failed', err: error });
          metricsEventEmitter.emit('mqSendMessageFail');
        })
        .then(() => {
          pendingOutboundMessages.delete(destUniqueMsgId);
          decrementPendingOutboundMessagesCount();
        });
    })
  );

  await longTermDb.addMessage(
    config.nodeId,
    longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
    message.type,
    message.request_id,
    {
      message,
      direction: longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
      destinations: receivers.map((receiver) => {
        if (receiver.proxy != null) {
          return {
            node_id: receiver.node_id,
            encryption_public_key: receiver.encryption_public_key,
            ip: receiver.proxy.ip,
            port: receiver.proxy.port,
            proxy_node_id: receiver.proxy.node_id,
            proxy_encryption_public_key: receiver.proxy.encryption_public_key,
            proxy_config: receiver.proxy.config,
          };
        } else {
          return {
            node_id: receiver.node_id,
            encryption_public_key: receiver.encryption_public_key,
            ip: receiver.ip,
            port: receiver.port,
          };
        }
      }),
      timestamp,
    }
  );
}

export function stopInbound() {
  mqService.eventEmitter.removeAllListeners('message');
}

export async function close() {
  mqService.close();
  if (pendingOutboundMessages.size > 0) {
    // Save pending outbound messages
    logger.info({
      message: 'Saving pending outbound messages',
      pendingOutboundMessageCount: pendingOutboundMessages.size,
    });
    await Promise.all(
      [...pendingOutboundMessages].map(([msgId, data]) =>
        cacheDb.setPendingOutboundMessage(config.nodeId, msgId, data)
      )
    );
  }
  for (const timerId of timers.values()) {
    clearTimeout(timerId);
  }
  timers.clear();
}

function incrementPendingOutboundMessagesCount() {
  pendingOutboundMessagesCount++;
  metricsEventEmitter.emit(
    'pendingOutboundMessagesCount',
    pendingOutboundMessagesCount
  );
}

function decrementPendingOutboundMessagesCount() {
  pendingOutboundMessagesCount--;
  metricsEventEmitter.emit(
    'pendingOutboundMessagesCount',
    pendingOutboundMessagesCount
  );
}

export function getPendingOutboundMessagesCount() {
  return pendingOutboundMessagesCount;
}

export function getPendingOutboundMessageMsgIds() {
  return Object.keys(pendingOutboundMessages);
}
