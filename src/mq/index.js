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

import EventEmitter from 'events';
import logger from '../logger';

import * as config from '../config';
import * as utils from '../utils';
import CustomError from '../error/custom_error';
import errorType from '../error/type';
import * as tendermintNdid from '../tendermint/ndid';
import * as db from '../db';

import MQSend from './mqsendcontroller.js';
import MQRecv from './mqrecvcontroller.js';

let mqSend;
let mqRecv;
const timer = {};

export const eventEmitter = new EventEmitter();

(async function init() {
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
  mqRecv = new MQRecv({ port: config.mqRegister.port, maxMsgSize: 2000000 });

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
})();

async function onMessage(jsonMessageStr) {
  try {
    const jsonMessage = JSON.parse(jsonMessageStr);

    let decrypted;
    try {
      decrypted = await utils.decryptAsymetricKey(jsonMessage);
    } catch (error) {
      throw new CustomError({
        message: errorType.DECRYPT_MESSAGE_ERROR.message,
        code: errorType.DECRYPT_MESSAGE_ERROR.code,
        cause: error,
      });
    }

    logger.debug({
      message: 'Raw decrypted message from message queue',
      decrypted,
    });

    //verify digital signature
    const [messageBase64, msqSignature] = decrypted.split('|');
    if (messageBase64 == null || msqSignature == null) {
      throw new CustomError({
        message: errorType.MALFORMED_MESSAGE_FORMAT.message,
        code: errorType.MALFORMED_MESSAGE_FORMAT.code,
      });
    }

    const rawMessage = Buffer.from(messageBase64, 'base64').toString();

    logger.debug({
      message: 'Split msqSignature',
      rawMessage,
      msqSignature,
    });

    const { idp_id, rp_id, as_id } = JSON.parse(rawMessage);
    const nodeId = idp_id || rp_id || as_id;
    const { public_key } = await tendermintNdid.getNodePubKey(nodeId);
    if (nodeId == null) {
      throw new CustomError({
        message: errorType.MESSAGE_FROM_UNKNOWN_NODE.message,
        code: errorType.MESSAGE_FROM_UNKNOWN_NODE.code,
      });
    }

    const signatureValid = utils.verifySignature(
      msqSignature,
      public_key,
      rawMessage
    );

    logger.debug({
      message: 'Verifying signature',
      msqSignature,
      public_key,
      rawMessage,
      signatureValid,
    });

    if (signatureValid) {
      eventEmitter.emit('message', rawMessage);
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
  const msqSignature = await utils.createSignature(message);
  const realPayload =
    Buffer.from(JSON.stringify(message)).toString('base64') +
    '|' +
    msqSignature;

  logger.debug({
    message: 'Sending message over message queue',
    raw_message_object: message,
    msqSignature,
    realPayload,
    receivers,
  });

  receivers.forEach(async (receiver) => {
    //cannot add signature in object because JSON.stringify may produce different string
    //for two object that is deep equal, hence, verify signature return false
    const encryptedMessage = utils.encryptAsymetricKey(
      receiver.public_key,
      realPayload
    );

    mqSend.send(receiver, JSON.stringify(encryptedMessage));
  });
}

export function close() {
  mqRecv.close();
  for (let id in timer) {
    clearTimeout(timer[id]);
  }
  logger.info({
    message: 'Message queue socket closed',
  });
}
