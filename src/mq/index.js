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
import zmq from 'zeromq';

import logger from '../logger';

import * as config from '../config';
import * as utils from '../utils';
import CustomError from '../error/custom_error';
import errorType from '../error/type';
import * as tendermintNdid from '../tendermint/ndid';

const receivingSocket = zmq.socket('pull');
receivingSocket.bindSync('tcp://*:' + config.mqRegister.port);

export const eventEmitter = new EventEmitter();

async function onMessage(jsonMessageStr) {
  try {
    const jsonMessage = JSON.parse(jsonMessageStr);

    const decrypted = await utils.decryptAsymetricKey(jsonMessage);

    logger.debug({
      message: 'Raw decrypted message from message queue',
      decrypted,
    });

    //verify digital signature
    const [raw_message, msqSignature] = decrypted.split('|');

    logger.debug({
      message: 'Split msqSignature',
      raw_message,
      msqSignature,
    });

    const { idp_id, rp_id, as_id } = JSON.parse(raw_message);
    const nodeId = idp_id || rp_id || as_id;
    const { public_key } = await tendermintNdid.getNodePubKey(nodeId);
    if (!nodeId) {
      throw new CustomError({
        message: errorType.MESSAGE_FROM_UNKNOWN_NODE.message,
        code: errorType.MESSAGE_FROM_UNKNOWN_NODE.code,
      });
    }

    const signatureValid = utils.verifySignature(
      msqSignature,
      public_key,
      raw_message
    );

    logger.debug({
      message: 'Verifying signature',
      msqSignature,
      public_key,
      raw_message,
      raw_message_object: JSON.parse(raw_message),
      signatureValid,
    });

    if (signatureValid) {
      eventEmitter.emit('message', raw_message);
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

receivingSocket.on('message', onMessage);

export async function send(receivers, message) {
  let msqSignature = await utils.createSignature(message);
  let realPayload = JSON.stringify(message) + '|' + msqSignature;

  logger.debug({
    message: 'Digital signature created',
    raw_message_object: message,
    msqSignature,
    realPayload,
  });

  receivers.forEach(async (receiver) => {
    const sendingSocket = zmq.socket('push');
    sendingSocket.connect(`tcp://${receiver.ip}:${receiver.port}`);

    //cannot add signature in object because JSON.stringify may produce different string
    //for two object that is deep equal, hence, verify signature return false
    let encryptedMessage = utils.encryptAsymetricKey(
      receiver.public_key,
      realPayload
    );
    sendingSocket.send(JSON.stringify(encryptedMessage));

    // TO BE REVISED
    // When should we disconnect the socket?
    // If the socket is disconnected, all the messages in queue will be lost.
    // Hence, the receiver may not get the messages.
    sendingSocket.disconnect(`tcp://${receiver.ip}:${receiver.port}`);
  });
}

export function close() {
  receivingSocket.close();
  logger.info({
    message: 'Message queue socket closed',
  });
}
