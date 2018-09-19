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

import * as db from '../redis_common';
import * as longTermDb from './redis';
import privateMessageType from '../../core/private_message_type';

import logger from '../../logger';
import CustomError from '../../error/custom_error';

const dbName = 'long-term';

function getName(messageType) {
  switch (messageType) {
    case privateMessageType.CHALLENGE_REQUEST:
      return 'challengeRequestMessage';
    case privateMessageType.IDP_RESPONSE:
      return 'idpResponseMessage';
    case privateMessageType.AS_DATA_RESPONSE:
      return 'asDataResponseMessage';
    case privateMessageType.CHALLENGE_RESPONSE:
      return 'challengeResponseMessage';
    case privateMessageType.CONSENT_REQUEST:
      return 'consentRequestMessage';
    case privateMessageType.DATA_REQUEST:
      return 'dataRequestMessage';
    default:
      throw new CustomError({
        message: 'Unknown message type',
        details: {
          messageType,
        },
      });
  }
}

export async function close() {
  await longTermDb.close();
  logger.info({
    message: 'DB connection closed',
    dbName,
  });
}

export function getAllMessages(nodeId, messageType) {
  return db.getAll({ nodeId, dbName, name: getName(messageType) });
}

export function getMessages(nodeId, messageType, requestId) {
  return db.getList({
    nodeId,
    dbName,
    name: getName(messageType),
    keyName: 'requestId',
    key: requestId,
    valueName: 'message',
  });
}

export function addMessage(nodeId, messageType, requestId, message) {
  return db.pushToList({
    nodeId,
    dbName,
    name: getName(messageType),
    keyName: 'requestId',
    key: requestId,
    valueName: 'message',
    value: message,
  });
}

export function removeMessages(nodeId, messageType, requestId) {
  return db.removeList({
    nodeId,
    dbName,
    name: getName(messageType),
    keyName: 'requestId',
    key: requestId,
  });
}

export function removeAllMessages(nodeId, messageType) {
  return db.removeAllLists({
    nodeId,
    dbName,
    name: getName(messageType),
  });
}
