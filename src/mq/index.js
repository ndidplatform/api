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

import CustomError from '../error/customError';
import * as tendermintNdid from '../tendermint/ndid';

import MQSend from './mqsendcontroller.js';
import MQRecv from './mqrecvcontroller.js';

const mqSend = new MQSend({timeout:60000, totalTimeout:500000});
const mqRecv = new MQRecv({port: config.mqRegister.port, maxMsgSize:2000000});

export const eventEmitter = new EventEmitter();

mqRecv.on('message', async function(jsonMessageStr) {

  const jsonMessage = JSON.parse(jsonMessageStr);

  let decrypted = await utils.decryptAsymetricKey(jsonMessage);

  logger.debug({
    message: 'Raw decrypted message from message queue',
    decrypted,
  });

  //verify digital signature
  let [raw_message, msqSignature] = decrypted.split('|');

  logger.debug({
    message: 'Split msqSignature',
    raw_message,
    msqSignature,
  });

  let { idp_id, rp_id, as_id } = JSON.parse(raw_message);
  let nodeId = idp_id || rp_id || as_id;
  let { public_key } = await tendermintNdid.getNodePubKey(nodeId);
  if (!nodeId)
    throw new CustomError({
      message: 'Receive message from unknown node',
    });

  let signatureValid = utils.verifySignature(
    msqSignature,
    public_key,
    raw_message
  );

  logger.debug({
    message: 'Verify signature',
    msqSignature,
    public_key,
    raw_message,
    raw_message_object: JSON.parse(raw_message),
    signatureValid,
  });

  if (signatureValid) {
    eventEmitter.emit('message', raw_message);
  } else
    throw new CustomError({
      message: 'Receive message with unmatched digital signature',
    });
});

export const send = async (receivers, message) => {
  let msqSignature = await utils.createSignature(message);
  let realPayload = JSON.stringify(message) + '|' + msqSignature;

  logger.debug({
    message: 'Digital signature created',
    raw_message_object: message,
    msqSignature,
    realPayload,
  });

  receivers.forEach(async (receiver) => {

    let encryptedMessage = utils.encryptAsymetricKey(
      receiver.public_key,
      realPayload
    );

    mqSend.send(receiver, JSON.stringify(encryptedMessage));
  });
};

export function close() {
  mqRecv.close();
  logger.info({
    message: 'Message queue socket closed',
  });
}
