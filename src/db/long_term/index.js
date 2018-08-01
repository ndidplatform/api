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

import * as db from '../sequelize_common';
import * as longTermDb from './sequelize';

import logger from '../../logger';
import CustomError from '../../error/custom_error';

const dbName = 'long-term';

function getName(messageType) {
  switch (messageType) {
    case 'challenge_request':
      return 'challengeRequestMessage';
    case 'idp_response':
      return 'idpResponseMessage';
    case 'as_data_response':
      return 'asDataResponseMessage';
    case 'challenge_response':
      return 'challengeResponseMessage';
    case 'consent_request':
      return 'consentRequestMessage';
    case 'data_request':
      return 'dataRequestMessage';
    default:
      throw new CustomError({
        message: 'Unknown message type',
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

export function getMessages(messageType, requestId) {
  return db.getList({
    dbName,
    name: getName(messageType),
    keyName: 'requestId',
    key: requestId,
    valueName: 'message',
  });
}

export function addMessage(messageType, requestId, message) {
  return db.pushToList({
    dbName,
    name: getName(messageType),
    keyName: 'requestId',
    key: requestId,
    valueName: 'message',
    value: message,
  });
}

export function removeMessages(messageType, requestId) {
  return db.removeList({
    dbName,
    name: getName(messageType),
    keyName: 'requestId',
    key: requestId,
  });
}

export function removeAllMessages(messageType) {
  return db.removeAllLists({
    dbName,
    name: getName(messageType),
  });
}
