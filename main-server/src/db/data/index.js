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

import logger from '../../logger';

const dbName = 'data';

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

export function getCallbackUrl(nodeId, callbackName) {
  return db.get({
    nodeId,
    dbName,
    name: 'callbackUrl',
    keyName: 'callbackName',
    key: callbackName,
    valueName: 'url',
  });
}

export function getCallbackUrls(nodeId, callbackNames) {
  return db.getMulti({
    nodeId,
    dbName,
    name: 'callbackUrl',
    keyName: 'callbackName',
    keys: callbackNames,
    valueName: 'url',
  });
}

export function setCallbackUrl(nodeId, callbackName, url) {
  return db.set({
    nodeId,
    dbName,
    name: 'callbackUrl',
    keyName: 'callbackName',
    key: callbackName,
    valueName: 'url',
    value: url,
  });
}

export function removeCallbackUrl(nodeId, callbackName) {
  return db.remove({
    nodeId,
    dbName,
    name: 'callbackUrl',
    keyName: 'callbackName',
    key: callbackName,
  });
}
