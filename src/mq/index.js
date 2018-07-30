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

import logger from '../logger';
import * as config from '../config';
import * as utils from '../utils';
import CustomError from '../error/custom_error';
import errorType from '../error/type';
import * as tendermintNdid from '../tendermint/ndid';
import * as db from '../db';

import MQSend from './mqsendcontroller.js';
import MQRecv from './mqrecvcontroller.js';

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

export const eventEmitter = new EventEmitter();

(async function init() {
  if (config.role === 'ndid') return;
  const timeoutList = await db.getAllDuplicateMessageTimeout();
  const promiseArray = [];
  for (let id in timeoutList) {
    let unixTimeout = timeoutList[id];
    if (unixTimeout >= Date.now()) {
      promiseArray.push(db.removeDuplicateMessageTimeout(id));
    } else {
      timer[id] = setTimeout(() => {
        db.removeDuplicateMessageTimeout(id);
        delete timer[id];
      }, Date.now() - unixTimeout);
    }
  }
  await Promise.all(promiseArray);
  mqSend = new MQSend({ timeout: 60000, totalTimeout: 500000 });
  mqRecv = new MQRecv({ port: config.mqRegister.port, maxMsgSize: 3250000 });

  mqRecv.on('message', async ({ message, msgId, senderId }) => {
    const id = senderId + ':' + msgId;
    let unixTimeout = await db.getDuplicateMessageTimeout(id);
    if (unixTimeout != null) return;

    unixTimeout = Date.now() + 120000;
    db.addDuplicateMessageTimeout(id, unixTimeout);
    timer[id] = setTimeout(() => {
      db.removeDuplicateMessageTimeout(id);
      delete timer[id];
    }, 120000);
    onMessage(message);
  });

  mqSend.on('error', (error) => logger.error(error.getInfoForLog()));
  mqRecv.on('error', (error) => logger.error(error.getInfoForLog()));
})();

async function onMessage(messageBuffer) {
  logger.info({
    message: 'Received message from message queue',
    messageLength: messageBuffer.length,
  });
  try {
    const decodedMessage = EncryptedMqMessage.decode(messageBuffer);
    const { encryptedSymmetricKey, encryptedMqMessage } = decodedMessage;
    let decryptedBuffer;
    try {
      decryptedBuffer = await utils.decryptAsymetricKey(
        encryptedSymmetricKey,
        encryptedMqMessage
      );
    } catch (error) {
      throw new CustomError({
        message: errorType.DECRYPT_MESSAGE_ERROR.message,
        code: errorType.DECRYPT_MESSAGE_ERROR.code,
        cause: error,
      });
    }

    logger.debug({
      message: 'Raw decrypted message from message queue',
      decryptedBuffer,
    });

    const decodedDecryptedMessage = MqMessage.decode(decryptedBuffer);
    const messageStr = decodedDecryptedMessage.message;
    const messageSignature = decodedDecryptedMessage.signature;
    if (messageStr == null || messageSignature == null) {
      throw new CustomError({
        message: errorType.MALFORMED_MESSAGE_FORMAT.message,
        code: errorType.MALFORMED_MESSAGE_FORMAT.code,
      });
    }

    logger.debug({
      message: 'Split message and signature',
      messageStr,
      messageSignature,
    });

    const { idp_id, rp_id, as_id } = JSON.parse(messageStr);
    const nodeId = idp_id || rp_id || as_id;
    const { public_key } = await tendermintNdid.getNodePubKey(nodeId);
    if (nodeId == null) {
      throw new CustomError({
        message: errorType.MESSAGE_FROM_UNKNOWN_NODE.message,
        code: errorType.MESSAGE_FROM_UNKNOWN_NODE.code,
      });
    }

    const signatureValid = utils.verifySignature(
      messageSignature,
      public_key,
      messageStr
    );

    logger.debug({
      message: 'Verifying signature',
      messageSignature,
      public_key,
      messageStr,
      signatureValid,
    });

    if (signatureValid) {
      eventEmitter.emit('message', messageStr);
    } else {
      throw new CustomError({
        message: errorType.INVALID_MESSAGE_SIGNATURE.message,
        code: errorType.INVALID_MESSAGE_SIGNATURE.code,
      });
    }
  } catch (error) {
    eventEmitter.emit('error', error);
  }
}

export async function send(receivers, message) {
  if (receivers.length === 0) {
    logger.debug({
      message: 'No receivers for message queue to send to',
      receivers,
      payload: message,
    });
    return;
  }
  const messageStr = JSON.stringify(message);
  const messageSignatureBuffer = await utils.createSignature(messageStr);
  const payload = {
    message: messageStr,
    signature: messageSignatureBuffer,
  };
  const protoMessage = MqMessage.create(payload);
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

  receivers.forEach(async (receiver) => {
    const {
      encryptedSymKey: encryptedSymmetricKey,
      encryptedMessage: encryptedMqMessage,
    } = utils.encryptAsymetricKey(receiver.public_key, protoBuffer);

    const encryptedPayload = {
      encryptedSymmetricKey,
      encryptedMqMessage,
    };
    const protoEncryptedMessage = EncryptedMqMessage.create(encryptedPayload);
    const protoEncryptedBuffer = EncryptedMqMessage.encode(
      protoEncryptedMessage
    ).finish();
    mqSend.send(receiver, protoEncryptedBuffer);
  });
}

export function close() {
  if (config.role === 'ndid') return;
  if (mqRecv) {
    mqRecv.close();
  }
  for (let id in timer) {
    clearTimeout(timer[id]);
  }
  logger.info({
    message: 'Message queue socket closed',
  });
}
