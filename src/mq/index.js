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

import MQSend from './mq_send_controller';
import MQRecv from './mq_recv_controller';
import * as tendermint from '../tendermint';
import * as tendermintNdid from '../tendermint/ndid';
import * as cacheDb from '../db/cache';
import * as longTermDb from '../db/long_term';
import * as utils from '../utils';
import logger from '../logger';
import CustomError from '../error/custom_error';
import errorType from '../error/type';
import * as config from '../config';

const mqMessageProtobufRoot = protobuf.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'mq_message.proto')
);
const encryptedMqMessageProtobufRoot = protobuf.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'encrypted_mq_message.proto')
);
const MqMessage = mqMessageProtobufRoot.lookup('MqMessage');
const EncryptedMqMessage = encryptedMqMessageProtobufRoot.lookup(
  'EncryptedMqMessage'
);

let mqSend;
let mqRecv;
const timer = {};

const rawMessagesToRetry = [];

export const eventEmitter = new EventEmitter();

export async function init() {
  const timeoutList = await cacheDb.getAllDuplicateMessageTimeout();
  const promiseArray = [];
  for (let id in timeoutList) {
    let unixTimeout = timeoutList[id];
    if (unixTimeout >= Date.now()) {
      promiseArray.push(cacheDb.removeDuplicateMessageTimeout(id));
    } else {
      timer[id] = setTimeout(() => {
        cacheDb.removeDuplicateMessageTimeout(id);
        delete timer[id];
      }, Date.now() - unixTimeout);
    }
  }
  await Promise.all(promiseArray);
  mqSend = new MQSend({ timeout: 60000, totalTimeout: 500000 });
  mqRecv = new MQRecv({ port: config.mqRegister.port, maxMsgSize: 3250000 });

  mqRecv.on('message', async ({ message, msgId, senderId }) => {
    const id = senderId + ':' + msgId;
    let unixTimeout = await cacheDb.getDuplicateMessageTimeout(id);
    if (unixTimeout != null) return;

    unixTimeout = Date.now() + 120000;
    cacheDb.setDuplicateMessageTimeout(id, unixTimeout);
    timer[id] = setTimeout(() => {
      cacheDb.removeDuplicateMessageTimeout(id);
      delete timer[id];
    }, 120000);
    onMessage(message);
  });

  //should tell client via error callback?
  mqSend.on('error', (error) => logger.error(error.getInfoForLog()));
  mqRecv.on('error', (error) => logger.error(error.getInfoForLog()));

  logger.info({
    message: 'Message queue initialized',
  });
}

async function onMessage(messageProtobuf) {
  logger.info({
    message: 'Received message from message queue',
    messageLength: messageProtobuf.length,
  });
  try {
    const messageId = utils.randomBase64Bytes(10);
    await cacheDb.setRawMessageFromMQ(messageId, messageProtobuf);

    // TODO: Refactor MQ module to send ACK here (after save to persistence)

    if (!tendermint.connected || tendermint.syncing) {
      rawMessagesToRetry[messageId] = messageProtobuf;
    } else {
      await processMessage(messageId, messageProtobuf);
    }
  } catch (error) {
    eventEmitter.emit('error', error);
  }
}

async function getMessageFromProtobufMessage(messageProtobuf, nodeId) {
  const decodedMessage = EncryptedMqMessage.decode(messageProtobuf);
  const { encryptedSymmetricKey, encryptedMqMessage } = decodedMessage;
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

async function processMessage(messageId, messageProtobuf) {
  logger.info({
    message: 'Processing raw received message from message queue',
    messageId,
    messageLength: messageProtobuf.length,
  });
  try {
    const decodedDecryptedMessage = getMessageFromProtobufMessage(
      messageProtobuf,
      config.nodeId
    );

    logger.debug({
      message: 'Decrypted message from message queue',
      decodedDecryptedMessage,
    });

    const messageForProxy = decodedDecryptedMessage.messageForProxy;

    let messageBuffer;
    let messageSignature;

    if (messageForProxy === true) {
      // Message is encapsulated with proxy layer

      // Verify signature
      const messageHashBase64 = utils.hash(decodedDecryptedMessage.message);
      const senderNodeId = decodedDecryptedMessage.senderNodeId;
      const signature = decodedDecryptedMessage.signature;
      const stringToVerify = `${messageHashBase64}|${receiverNodeId}|${senderNodeId}`;

      const proxyPublicKey = await tendermintNdid.getNodePubKey(senderNodeId);

      const signatureValid = utils.verifySignature(
        signature,
        proxyPublicKey,
        stringToVerify
      );

      if (!signatureValid) {
        throw new CustomError({
          errorType: errorType.INVALID_MESSAGE_SIGNATURE,
        });
      }

      const receiverNodeId = decodedDecryptedMessage.receiverNodeId;

      if (receiverNodeId == null || receiverNodeId === '') {
        throw new CustomError({
          errorType: errorType.MALFORMED_MESSAGE_FORMAT,
        });
      }

      const decodedDecryptedMessage = getMessageFromProtobufMessage(
        decodedDecryptedMessage.message,
        receiverNodeId
      );

      logger.debug({
        message: 'Decrypted message from message queue (inner layer)',
        decodedDecryptedMessage,
      });

      messageBuffer = decodedDecryptedMessage.message;
      messageSignature = decodedDecryptedMessage.signature;
    } else {
      messageBuffer = decodedDecryptedMessage.message;
      messageSignature = decodedDecryptedMessage.signature;
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
    const publicKey = await tendermintNdid.getNodePubKey(nodeId);

    const signatureValid = utils.verifySignature(
      messageSignature,
      publicKey,
      messageStr
    );

    logger.debug({
      message: 'Verifying signature',
      messageSignature,
      publicKey,
      messageStr,
      signatureValid,
    });

    if (!signatureValid) {
      throw new CustomError({
        errorType: errorType.INVALID_MESSAGE_SIGNATURE,
      });
    }

    // TODO: validate message schema

    await longTermDb.addMessage(
      // longTermDb.MESSAGE_DIRECTIONS.INBOUND,
      message.type,
      message.request_id,
      messageStr
    );

    eventEmitter.emit('message', message);
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
    await cacheDb.removeRawMessageFromMQ(messageId);
  } catch (error) {
    logger.error({
      message: 'Cannot remove raw received message from MQ from cache DB',
      messageId,
      error,
    });
  }
}

async function retryProcessMessages() {
  Object.entries(rawMessagesToRetry).map(([messageId, messageBuffer]) => {
    processMessage(messageId, messageBuffer);
    delete rawMessagesToRetry[messageId];
  });
}

/**
 * This function should be called once on server start
 */
export async function loadAndProcessBacklogMessages() {
  logger.info({
    message: 'Loading backlog messages received from MQ for processing',
  });
  try {
    let rawMessages = await cacheDb.getAllRawMessageFromMQ();
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
  const messageStr = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageStr, 'utf8');
  const messageSignatureBuffer = await utils.createSignature(messageStr);
  const mqMessageObject = {
    message: messageBuffer,
    signature: messageSignatureBuffer,
    senderNodeId,
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
      const {
        encryptedSymKey: encryptedSymmetricKey,
        encryptedMessage: encryptedMqMessage,
      } = utils.encryptAsymetricKey(receiver.public_key, protoBuffer);

      const encryptedMqMessageObject = {
        encryptedSymmetricKey,
        encryptedMqMessage,
      };
      const protoEncryptedMessage = EncryptedMqMessage.create(
        encryptedMqMessageObject
      );
      const protoEncryptedBuffer = EncryptedMqMessage.encode(
        protoEncryptedMessage
      ).finish();

      let payloadBuffer;
      if (receiver.proxy != null) {
        // Encapsulate proxy layer

        const messageHashBase64 = utils.hash(protoEncryptedBuffer);
        const receiverNodeId = receiver.node_id;
        const senderNodeId = config.nodeId;
        const signatureBuffer = await utils.createSignature(
          `${messageHashBase64}|${receiverNodeId}|${senderNodeId}`
        );

        const mqMessageObject = {
          message: protoEncryptedBuffer,
          signature: signatureBuffer,
          receiverNodeId,
          senderNodeId,
        };
        const protoMessage = MqMessage.create(mqMessageObject);
        const protoBuffer = MqMessage.encode(protoMessage).finish();

        const {
          encryptedSymKey: encryptedSymmetricKey,
          encryptedMessage: encryptedMqMessage,
        } = utils.encryptAsymetricKey(receiver.proxy.public_key, protoBuffer);

        const encryptedMqMessageObject = {
          encryptedSymmetricKey,
          encryptedMqMessage,
        };
        const protoEncryptedMessage = EncryptedMqMessage.create(
          encryptedMqMessageObject
        );
        const protoEncryptedBuffer = EncryptedMqMessage.encode(
          protoEncryptedMessage
        ).finish();

        payloadBuffer = protoEncryptedBuffer;
      } else {
        payloadBuffer = protoEncryptedBuffer;
      }

      mqSend.send(receiver, payloadBuffer);
    })
  );

  // await longTermDb.addMessage(
  //   longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
  //   message.type,
  //   message.request_id,
  //   messageStr
  // );
}

export function close() {
  if (mqRecv) {
    logger.info({
      message: 'Message queue socket closed',
    });
    mqRecv.close();
  }
  for (let id in timer) {
    clearTimeout(timer[id]);
  }
}

tendermint.eventEmitter.on('ready', function() {
  retryProcessMessages();
});
