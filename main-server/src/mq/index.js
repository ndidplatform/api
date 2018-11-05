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

import * as mqService from './grpc_client';
import * as tendermint from '../tendermint';
import * as tendermintNdid from '../tendermint/ndid';
import * as cacheDb from '../db/cache';
import * as longTermDb from '../db/long_term';
import * as utils from '../utils';
import logger from '../logger';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import validate from './message/validator';

import { role } from '../node';
import * as config from '../config';

const MQ_SEND_TOTAL_TIMEOUT = 600000;

const mqMessageProtobufRootInstance = new protobuf.Root();
const mqMessageProtobufRoot = mqMessageProtobufRootInstance.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'mq_message.proto'),
  { keepCase: true }
);
const encryptedMqMessageProtobufRootInstance = new protobuf.Root();
const encryptedMqMessageProtobufRoot = encryptedMqMessageProtobufRootInstance.loadSync(
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
const EncryptedMqMessage = encryptedMqMessageProtobufRoot.lookupType(
  'EncryptedMqMessage'
);

let outboundMessageId = Date.now();
const pendingOutboundMessages = {};
const timer = {};

const rawMessagesToRetry = [];

export const eventEmitter = new EventEmitter();

export async function initialize() {
  logger.info({
    message: 'Initializing message queue',
  });

  const timeoutList = await cacheDb.getAllDuplicateMessageTimeout(
    config.nodeId
  );
  const promiseArray = [];
  timeoutList.forEach(({ id, unixTimeout }) => {
    if (unixTimeout >= Date.now()) {
      promiseArray.push(
        cacheDb.removeDuplicateMessageTimeout(config.nodeId, id)
      );
    } else {
      timer[id] = setTimeout(() => {
        cacheDb.removeDuplicateMessageTimeout(config.nodeId, id);
        delete timer[id];
      }, Date.now() - unixTimeout);
    }
  });
  await Promise.all(promiseArray);

  // Load saved pending outbound messages
  logger.info({
    message: 'Loading saved pending outbound messages',
  });
  const savedPendingOutboundMessages = await cacheDb.getAllPendingOutboundMessages(
    config.nodeId
  );

  await mqService.initialize();

  mqService.eventEmitter.on('message', onMessage);

  //should tell client via error callback?
  mqService.eventEmitter.on('error', (error) =>
    logger.error(error.getInfoForLog())
  );

  mqService.subscribeToRecvMessages();

  // Send saved pending outbound messages
  if (savedPendingOutboundMessages.length > 0) {
    logger.info({
      message: 'Sending saved pending outbound messages',
      savedPendingOutboundMessageCount: savedPendingOutboundMessages.length,
    });
  }
  await Promise.all(
    savedPendingOutboundMessages.map(async ({ msgId: msgIdStr, data }) => {
      const msgId = Number(msgIdStr);
      const { mqDestAddress, payloadBuffer: payloadBufferArr, sendTime } = data;
      if (sendTime + MQ_SEND_TOTAL_TIMEOUT > Date.now()) {
        const payloadBuffer = Buffer.from(payloadBufferArr);
        pendingOutboundMessages[msgId] = {
          mqDestAddress,
          payloadBuffer,
          sendTime,
        };
        mqService
          .sendMessage(
            mqDestAddress,
            payloadBuffer,
            msgId,
            true,
            MQ_SEND_TOTAL_TIMEOUT
          )
          .then(() => delete pendingOutboundMessages[msgId])
          .catch((error) => logger.error(error.getInfoForLog()));
      }
      await cacheDb.removePendingOutboundMessage(config.nodeId, msgId);
    })
  );

  logger.info({
    message: 'Message queue initialized',
  });
}

async function onMessage({ message, msgId, senderId }) {
  logger.info({
    message: 'Received message from message queue',
    msgId,
    messageLength: message.length,
    senderId,
  });

  // Check for duplicate message
  const timestamp = Date.now();
  const id = senderId + ':' + msgId;
  if (timer[id] != null) return;

  const unixTimeout = timestamp + MQ_SEND_TOTAL_TIMEOUT;
  cacheDb.setDuplicateMessageTimeout(config.nodeId, id, unixTimeout);
  timer[id] = setTimeout(() => {
    cacheDb.removeDuplicateMessageTimeout(config.nodeId, id);
    delete timer[id];
  }, MQ_SEND_TOTAL_TIMEOUT);

  try {
    await cacheDb.setRawMessageFromMQ(config.nodeId, id, message);
    mqService
      .sendAckForRecvMessage(msgId)
      .catch((error) => logger.error(error.getInfoForLog()));

    if (
      !tendermint.connected ||
      tendermint.syncing ||
      !cacheDb.getRedisInstance().connected ||
      !longTermDb.getRedisInstance().connected
    ) {
      rawMessagesToRetry[id] = message;
    } else {
      await processMessage(id, message, timestamp);
    }
  } catch (error) {
    eventEmitter.emit('error', error);
  }
}

async function getMessageFromProtobufMessage(messageProtobuf, nodeId) {
  const decodedMessage = EncryptedMqMessage.decode(messageProtobuf);
  const {
    encrypted_symmetric_key: encryptedSymmetricKey,
    encrypted_mq_message: encryptedMqMessage,
  } = decodedMessage;
  let decryptedBuffer;
  try {
    decryptedBuffer = await utils.decryptAsymetricKey(
      nodeId,
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

async function processMessage(messageId, messageProtobuf, timestamp) {
  logger.info({
    message: 'Processing raw received message from message queue',
    messageId,
    messageLength: messageProtobuf.length,
  });
  try {
    const outerLayerDecodedDecryptedMessage = await getMessageFromProtobufMessage(
      messageProtobuf,
      config.nodeId
    );

    logger.debug({
      message: 'Decrypted message from message queue',
      outerLayerDecodedDecryptedMessage,
    });

    let messageBuffer;
    let messageSignature;
    let receiverNodeId;
    let signatureForProxy;

    if (role === 'proxy') {
      // Message is encapsulated with proxy layer
      const proxyDecodedDecryptedMessage =
        outerLayerDecodedDecryptedMessage.message;

      // Verify signature
      const proxyMessageHashBase64 = utils.hash(proxyDecodedDecryptedMessage);
      const senderNodeId = outerLayerDecodedDecryptedMessage.sender_node_id;
      signatureForProxy = outerLayerDecodedDecryptedMessage.signature;
      receiverNodeId = outerLayerDecodedDecryptedMessage.receiver_node_id;
      if (
        receiverNodeId == null ||
        receiverNodeId === '' ||
        senderNodeId == null ||
        senderNodeId === ''
      ) {
        throw new CustomError({
          errorType: errorType.MALFORMED_MESSAGE_FORMAT,
        });
      }

      const stringToVerify = `${proxyMessageHashBase64}|${receiverNodeId}|${senderNodeId}`;

      const proxyPublicKey = await tendermintNdid.getNodePubKey(senderNodeId);

      const signatureValid = utils.verifySignature(
        signatureForProxy,
        proxyPublicKey,
        stringToVerify
      );

      if (!signatureValid) {
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

      messageBuffer = decodedDecryptedMessage.message;
      messageSignature = decodedDecryptedMessage.signature;
    } else {
      receiverNodeId = config.nodeId;
      messageBuffer = outerLayerDecodedDecryptedMessage.message;
      messageSignature = outerLayerDecodedDecryptedMessage.signature;
    }

    if (messageBuffer == null || messageSignature == null) {
      throw new CustomError({
        errorType: errorType.MALFORMED_MESSAGE_FORMAT,
      });
    }

    const messageStr = messageBuffer.toString('utf8');

    logger.debug({
      message: 'Split message and signature',
      messageStr,
      messageSignature,
    });

    const message = JSON.parse(messageStr);

    const { idp_id, rp_id, as_id } = message;
    const nodeId = idp_id || rp_id || as_id;
    if (nodeId == null) {
      throw new CustomError({
        errorType: errorType.MESSAGE_FROM_UNKNOWN_NODE,
      });
    }
    const nodeInfo = await tendermintNdid.getNodeInfo(nodeId);
    const publicKey = nodeInfo.public_key;

    const signatureValid = utils.verifySignature(
      messageSignature,
      publicKey,
      messageStr
    );

    logger.debug({
      message: 'Verifying signature',
      messageSignature,
      nodeId,
      publicKey,
      messageStr,
      signatureValid,
    });

    if (!signatureValid) {
      throw new CustomError({
        errorType: errorType.INVALID_MESSAGE_SIGNATURE,
      });
    }

    const validationResult = validate({ type: message.type, message });
    if (!validationResult.valid) {
      throw new CustomError({
        errorType: errorType.INVALID_MESSAGE_SCHEMA,
        details: {
          fromNodeId: nodeId,
          validationResult,
        },
      });
    }

    const source =
      nodeInfo.proxy != null
        ? {
            node_id: nodeId,
            proxy_node_id: nodeInfo.proxy.node_id,
            proxy_config: nodeInfo.proxy.config,
          }
        : {
            node_id: nodeId,
          };
    await longTermDb.addMessage(
      receiverNodeId,
      longTermDb.MESSAGE_DIRECTIONS.INBOUND,
      message.type,
      message.request_id,
      {
        message: messageStr,
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

    eventEmitter.emit('message', message, receiverNodeId);
    removeRawMessageFromCache(messageId);
  } catch (error) {
    eventEmitter.emit('error', error);
    logger.warn({
      message:
        'Error processing received message from message queue. Discarding message.',
      error,
    });
    removeRawMessageFromCache(messageId);
  }
}

async function removeRawMessageFromCache(messageId) {
  logger.debug({
    message: 'Removing raw received message from MQ from cache DB',
    messageId,
  });
  try {
    await cacheDb.removeRawMessageFromMQ(config.nodeId, messageId);
  } catch (error) {
    logger.error({
      message: 'Cannot remove raw received message from MQ from cache DB',
      messageId,
      error,
    });
  }
}

function retryProcessMessages() {
  if (
    tendermint.connected &&
    !tendermint.syncing &&
    cacheDb.getRedisInstance().connected &&
    longTermDb.getRedisInstance().connected
  ) {
    Object.entries(rawMessagesToRetry).map(([messageId, messageBuffer]) => {
      processMessage(messageId, messageBuffer);
      delete rawMessagesToRetry[messageId];
    });
  }
}

/**
 * Load and process backlog received (inbound) messages.
 * This function should be called once on server start.
 */
export async function loadAndProcessBacklogMessages() {
  logger.info({
    message: 'Loading backlog messages received from MQ for processing',
  });
  try {
    let rawMessages = await cacheDb.getAllRawMessageFromMQ(config.nodeId);
    if (rawMessages.length === 0) {
      logger.info({
        message: 'No backlog messages received from MQ to process',
      });
    }
    rawMessages.map(({ messageId, messageBuffer }) =>
      processMessage(messageId, messageBuffer)
    );
  } catch (error) {
    logger.error({
      message: 'Cannot get backlog messages received from MQ from cache DB',
    });
  }
}

export async function send(receivers, message, senderNodeId) {
  if (receivers.length === 0) {
    logger.debug({
      message: 'No receivers for message queue to send to',
      receivers,
      payload: message,
    });
    return;
  }
  const timestamp = Date.now();

  const messageStr = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageStr, 'utf8');
  const messageSignatureBuffer = await utils.createSignature(
    messageStr,
    senderNodeId
  );
  const mqMessageObject = {
    message: messageBuffer,
    signature: messageSignatureBuffer,
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
    protoBuffer,
  });

  await Promise.all(
    receivers.map(async (receiver) => {
      const { encryptedSymKey, encryptedMessage } = utils.encryptAsymetricKey(
        receiver.public_key,
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

      let mqDestAddress;
      let payloadBuffer;
      if (receiver.proxy != null) {
        // Encapsulate proxy layer
        const proxyMessageHashBase64 = utils.hash(protoEncryptedBuffer);
        const receiverNodeId = receiver.node_id;
        const senderNodeId = config.nodeId;
        const proxySignatureBuffer = await utils.createSignature(
          `${proxyMessageHashBase64}|${receiverNodeId}|${senderNodeId}`,
          senderNodeId
        );

        const proxyMqMessageObject = {
          message: protoEncryptedBuffer,
          signature: proxySignatureBuffer,
          receiver_node_id: receiverNodeId,
          sender_node_id: senderNodeId,
        };
        const proxyProtoMessage = MqMessage.create(proxyMqMessageObject);
        const proxyProtoBuffer = MqMessage.encode(proxyProtoMessage).finish();

        const {
          encryptedSymKey: proxyEncryptedSymmetricKey,
          encryptedMessage: proxyEncryptedMqMessage,
        } = utils.encryptAsymetricKey(
          receiver.proxy.public_key,
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
      } else {
        payloadBuffer = protoEncryptedBuffer;
        mqDestAddress = {
          ip: receiver.ip,
          port: receiver.port,
        };
      }

      const msgId = outboundMessageId++;
      pendingOutboundMessages[msgId] = {
        mqDestAddress,
        payloadBuffer,
        sendTime: Date.now(),
      };

      logger.debug({
        message: 'Sending message to message queue service server',
        msgId,
        mqDestAddress,
      });
      mqService
        .sendMessage(
          mqDestAddress,
          payloadBuffer,
          msgId,
          true,
          MQ_SEND_TOTAL_TIMEOUT
        )
        .then(() => delete pendingOutboundMessages[msgId])
        .catch((error) => logger.error(error.getInfoForLog()));
    })
  );

  await longTermDb.addMessage(
    config.nodeId,
    longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
    message.type,
    message.request_id,
    {
      message: messageStr,
      direction: longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
      destinations: receivers.map((receiver) => {
        if (receiver.proxy != null) {
          return {
            node_id: receiver.node_id,
            public_key: receiver.public_key,
            ip: receiver.proxy.ip,
            port: receiver.proxy.port,
            proxy_node_id: receiver.proxy.node_id,
            proxy_public_key: receiver.proxy.public_key,
            proxy_config: receiver.proxy.config,
          };
        } else {
          return {
            node_id: receiver.node_id,
            public_key: receiver.public_key,
            ip: receiver.ip,
            port: receiver.port,
          };
        }
      }),
      timestamp,
    }
  );
}

export async function close() {
  mqService.close();
  if (Object.keys(pendingOutboundMessages).length > 0) {
    // Save pending outbound messages
    logger.info({
      message: 'Saving pending outbound messages',
      pendingOutboundMessageCount: Object.keys(pendingOutboundMessages).length,
    });
    await Promise.all(
      Object.entries(pendingOutboundMessages).map(([msgId, data]) =>
        cacheDb.setPendingOutboundMessage(config.nodeId, msgId, data)
      )
    );
  }
  for (let id in timer) {
    clearTimeout(timer[id]);
  }
}

tendermint.eventEmitter.on('ready', retryProcessMessages);

cacheDb.getRedisInstance().on('reconnect', retryProcessMessages);
longTermDb.getRedisInstance().on('reconnect', retryProcessMessages);
