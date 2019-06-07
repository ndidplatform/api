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

import * as dataDb from '../db/data';
import { callbackToClient } from '../callback';
import { getFunction } from '../functions';

import logger from '../logger';

import * as config from '../config';

const CALLBACK_URL_NAME = {
  MESSAGE_QUEUE_SEND_SUCCESS: 'message_queue_send_success_url',
};
const CALLBACK_URL_NAME_ARR = Object.values(CALLBACK_URL_NAME);

export async function checkCallbackUrls() {
  const callbackUrls = await getCallbackUrls();
  for (let i = 0; i < CALLBACK_URL_NAME_ARR.length; i++) {
    const callbackName = CALLBACK_URL_NAME_ARR[i];
    if (callbackUrls[callbackName] != null) {
      logger.info({
        message: `[Node] ${callbackName} callback url`,
        callbackUrl: callbackUrls[callbackName],
      });
    } else {
      logger.warn({
        message: `[Node] ${callbackName} callback url is not set`,
      });
    }
  }
}

export async function setCallbackUrls({ message_queue_send_success_url }) {
  if (message_queue_send_success_url != null) {
    await dataDb.setCallbackUrl(
      config.nodeId,
      `node.${CALLBACK_URL_NAME.MESSAGE_QUEUE_SEND_SUCCESS}`,
      message_queue_send_success_url
    );
  }
}

export async function getCallbackUrls() {
  const callbackNames = CALLBACK_URL_NAME_ARR.map((name) => `node.${name}`);
  const callbackUrlsArr = await dataDb.getCallbackUrls(
    config.nodeId,
    callbackNames
  );
  const callbackUrls = callbackUrlsArr.reduce((callbackUrlsObj, url, index) => {
    if (url != null) {
      return {
        ...callbackUrlsObj,
        [callbackNames[index].replace(/^node\./, '')]: url,
      };
    } else {
      return callbackUrlsObj;
    }
  }, {});
  return callbackUrls;
}

export function getMessageQueueSendSuccessCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `node.${CALLBACK_URL_NAME.MESSAGE_QUEUE_SEND_SUCCESS}`
  );
}

export async function notifyMessageQueueSuccessSend({
  nodeId,
  getCallbackUrlFnName,
  destNodeId,
  destIp,
  destPort,
  requestId,
}) {
  logger.debug({
    message: 'Notifying message queue success send through callback',
  });
  const callbackUrl = await getFunction(getCallbackUrlFnName)();
  if (callbackUrl == null) {
    logger.warn({
      message: 'MQ success send callback URL has not been set',
    });
    return;
  }
  await callbackToClient({
    getCallbackUrlFnName,
    body: {
      node_id: nodeId,
      type: 'message_queue_send_success',
      destination_node_id: destNodeId,
      destination_ip: destIp,
      destination_port: destPort,
      request_id: requestId,
    },
    retry: false,
  });
}
