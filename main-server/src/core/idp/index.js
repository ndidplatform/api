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

import fetch from 'node-fetch';

import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../../logger';

import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../common';
import * as utils from '../../utils';
import * as config from '../../config';
import * as cacheDb from '../../db/cache';
import * as dataDb from '../../db/data';
import * as identity from '../identity';
import privateMessageType from '../../mq/message/type';

export * from './create_response';
export * from './event_handlers';
export * from './request_message_padded_hash';

const CALLBACK_URL_NAME = {
  INCOMING_REQUEST: 'incoming_request_url',
  INCOMING_REQUEST_STATUS_UPDATE: 'incoming_request_status_update_url',
  IDENTITY_MODIFICATION_NOTIFICATION: 'identity_modification_notification_url',
  ERROR: 'error_url',
};
const CALLBACK_URL_NAME_ARR = Object.values(CALLBACK_URL_NAME);

export async function checkCallbackUrls() {
  const callbackUrls = await getCallbackUrls();
  for (let i = 0; i < CALLBACK_URL_NAME_ARR.length; i++) {
    const callbackName = CALLBACK_URL_NAME_ARR[i];
    if (callbackUrls[callbackName] != null) {
      logger.info({
        message: `[IdP] ${callbackName} callback url`,
        callbackUrl: callbackUrls[callbackName],
      });
    } else {
      logger.warn({
        message: `[IdP] ${callbackName} callback url is not set`,
      });
    }
  }
}

export async function setCallbackUrls({
  incoming_request_url,
  incoming_request_status_update_url,
  identity_modification_notification_url,
  error_url,
}) {
  const promises = [];
  if (incoming_request_url != null) {
    promises.push(
      dataDb.setCallbackUrl(
        config.nodeId,
        `idp.${CALLBACK_URL_NAME.INCOMING_REQUEST}`,
        incoming_request_url
      )
    );
  }
  if (incoming_request_status_update_url != null) {
    promises.push(
      dataDb.setCallbackUrl(
        config.nodeId,
        `idp.${CALLBACK_URL_NAME.INCOMING_REQUEST_STATUS_UPDATE}`,
        incoming_request_status_update_url
      )
    );
  }
  if (identity_modification_notification_url != null) {
    promises.push(
      dataDb.setCallbackUrl(
        config.nodeId,
        `idp.${CALLBACK_URL_NAME.IDENTITY_MODIFICATION_NOTIFICATION}`,
        identity_modification_notification_url
      )
    );
  }
  if (error_url != null) {
    promises.push(
      dataDb.setCallbackUrl(
        config.nodeId,
        `idp.${CALLBACK_URL_NAME.ERROR}`,
        error_url
      )
    );
  }
  await Promise.all(promises);
}

export async function getCallbackUrls() {
  const callbackNames = CALLBACK_URL_NAME_ARR.map((name) => `idp.${name}`);
  const callbackUrlsArr = await dataDb.getCallbackUrls(
    config.nodeId,
    callbackNames
  );
  const callbackUrls = callbackUrlsArr.reduce((callbackUrlsObj, url, index) => {
    if (url != null) {
      return {
        ...callbackUrlsObj,
        [callbackNames[index].replace(/^idp\./, '')]: url,
      };
    } else {
      return callbackUrlsObj;
    }
  }, {});
  return callbackUrls;
}

export function getErrorCallbackUrl() {
  return dataDb.getCallbackUrl(config.nodeId, `idp.${CALLBACK_URL_NAME.ERROR}`);
}

export function getIncomingRequestCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `idp.${CALLBACK_URL_NAME.INCOMING_REQUEST}`
  );
}

export function getIncomingRequestStatusUpdateCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `idp.${CALLBACK_URL_NAME.INCOMING_REQUEST_STATUS_UPDATE}`
  );
}

export function getIdentityModificationNotificationCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `idp.${CALLBACK_URL_NAME.IDENTITY_MODIFICATION_NOTIFICATION}`
  );
}

export async function notifyIncomingRequestByCallback(
  nodeId,
  eventDataForCallback
) {
  const url = await getIncomingRequestCallbackUrl();
  const type = 'incoming_request';
  if (!url) {
    logger.error({
      message: `Callback URL for type: ${type} has not been set`,
    });
    return;
  }
  await callbackToClient({
    getCallbackUrlFnName: 'idp.getIncomingRequestCallbackUrl',
    body: {
      node_id: nodeId,
      type,
      ...eventDataForCallback,
    },
    retry: true,
    shouldRetry: 'common.isRequestClosedOrTimedOut',
    shouldRetryArguments: [eventDataForCallback.request_id],
  });
}

function checkReceiverIntegrity(requestId, requestDetail, nodeId) {
  const filterIdpList = requestDetail.idp_id_list.filter((node_id) => {
    return node_id === nodeId;
  });
  if (filterIdpList.length === 0) {
    logger.warn({
      message: 'Request does not involve receiver node',
      requestId,
    });
    logger.debug({
      message: 'Request does not involve receiver node',
      requestId,
      idp_id_list: requestDetail.request_message,
      receiverNodeId: nodeId,
    });
    return false;
  }
  return true;
}

export async function processMessage(nodeId, messageId, message) {
  const requestId = message.request_id;
  logger.debug({
    message: 'Processing message',
    nodeId,
    messageId,
    requestId,
  });

  try {
    if (message.type === privateMessageType.IDP_RESPONSE) {
      await identity.onReceiveIdpResponseForIdentity({ nodeId, message });
    } else if (message.type === privateMessageType.CONSENT_REQUEST) {
      const requestDetail = await tendermintNdid.getRequestDetail({
        requestId: message.request_id,
      });

      if (requestDetail.closed || requestDetail.timed_out) {
        return;
      }

      await cacheDb.setRequestReceivedFromMQ(
        nodeId,
        message.request_id,
        message
      );

      const messageValid = common.checkRequestMessageIntegrity(
        message.request_id,
        message,
        requestDetail
      );
      const receiverValid = checkReceiverIntegrity(
        message.request_id,
        requestDetail,
        nodeId
      );
      const valid = messageValid && receiverValid;
      if (!valid) {
        throw new CustomError({
          errorType: errorType.REQUEST_INTEGRITY_CHECK_FAILED,
          details: {
            requestId: message.request_id,
          },
        });
      }
      let dataToNotify = {
        mode: message.mode,
        request_id: message.request_id,
        request_message: message.request_message,
        request_message_hash: requestDetail.request_message_hash,
        request_message_salt: message.request_message_salt,
        requester_node_id: message.rp_id,
        min_ial: message.min_ial,
        min_aal: message.min_aal,
        data_request_list: message.data_request_list,
        initial_salt: message.initial_salt,
        creation_time: message.creation_time,
        creation_block_height: `${requestDetail.creation_chain_id}:${
          requestDetail.creation_block_height
        }`,
        request_timeout: message.request_timeout,
      };
      //already onboarded
      if (message.reference_group_code) {
        dataToNotify.reference_group_code = message.reference_group_code;
        // mode 1 or on-the-fly onboard
      } else {
        dataToNotify.namespace = message.namespace;
        dataToNotify.identifier = message.identifier;
      }
      notifyIncomingRequestByCallback(nodeId, dataToNotify);
    } else {
      logger.warn({
        message: 'Cannot process unknown message type',
        type: message.type,
      });
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing message from message queue',
      cause: error,
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'idp.getErrorCallbackUrl',
      action: 'idp.processMessage',
      error: err,
      requestId,
    });
    throw err;
  }
}
