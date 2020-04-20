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
import redisInstance from './redis';
import privateMessageType from '../../mq/message/type';

import logger from '../../logger';
import CustomError from 'ndid-error/custom_error';

const dbName = 'long-term';

export const MESSAGE_DIRECTIONS = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
};

function getName(messageType) {
  switch (messageType) {
    case privateMessageType.IDP_RESPONSE:
      return 'idpResponseMessage';
    case privateMessageType.AS_RESPONSE:
      return 'asResponseMessage';
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

export function getRedisInstance() {
  return redisInstance;
}

export function initialize() {
  return redisInstance.connect();
}

export async function close() {
  await redisInstance.close();
  logger.info({
    message: 'DB connection closed',
    dbName,
  });
}

export function getAllMessages(nodeId, direction, messageType) {
  return db.getAll({
    nodeId,
    dbName,
    name: `${direction}_${getName(messageType)}`,
  });
}

export function getMessages(nodeId, direction, messageType, requestId) {
  return db.getList({
    nodeId,
    dbName,
    name: `${direction}_${getName(messageType)}`,
    keyName: 'requestId',
    key: requestId,
    valueName: 'messageWithMetadata',
  });
}

export function addMessage(
  nodeId,
  direction,
  messageType,
  requestId,
  messageWithMetadata
) {
  return db.pushToList({
    nodeId,
    dbName,
    name: `${direction}_${getName(messageType)}`,
    keyName: 'requestId',
    key: requestId,
    valueName: 'messageWithMetadata',
    value: messageWithMetadata,
  });
}

export function removeMessages(nodeId, direction, messageType, requestId) {
  return db.removeList({
    nodeId,
    dbName,
    name: `${direction}_${getName(messageType)}`,
    keyName: 'requestId',
    key: requestId,
  });
}

export function removeAllMessages(nodeId, direction, messageType) {
  return db.removeAllLists({
    nodeId,
    dbName,
    name: `${direction}_${getName(messageType)}`,
  });
}
