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

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import * as cacheDb from '../../../db/cache';
import * as dataDb from '../../../db/data';

import logger from '../../../logger';

import * as config from '../../../config';
import { role } from '../../../node';

export * from './register_or_update_as_service';
export * from './respond_to_rp';
export * from './message_handlers';

const CALLBACK_URL_NAME = {
  INCOMING_REQUEST_STATUS_UPDATE: 'incoming_request_status_update_url',
};
const CALLBACK_URL_NAME_ARR = Object.values(CALLBACK_URL_NAME);

export async function checkCallbackUrls() {
  const callbackUrls = await getCallbackUrls();
  for (let i = 0; i < CALLBACK_URL_NAME_ARR.length; i++) {
    const callbackName = CALLBACK_URL_NAME_ARR[i];
    if (callbackUrls[callbackName] != null) {
      logger.info({
        message: `[YourData/AS] ${callbackName} callback url`,
        callbackUrl: callbackUrls[callbackName],
      });
    } else {
      logger.warn({
        message: `[YourData/AS] ${callbackName} callback url is not set`,
      });
    }
  }
}

export async function setCallbackUrls({ incoming_request_status_update_url }) {
  const promises = [];
  if (incoming_request_status_update_url != null) {
    promises.push(
      dataDb.setCallbackUrl(
        config.nodeId,
        `yourdata_as.${CALLBACK_URL_NAME.INCOMING_REQUEST_STATUS_UPDATE}`,
        incoming_request_status_update_url
      )
    );
  }
  await Promise.all(promises);
}

export async function getCallbackUrls() {
  const callbackNames = CALLBACK_URL_NAME_ARR.map((name) => `yourdata_as.${name}`);
  const callbackUrlsArr = await dataDb.getCallbackUrls(
    config.nodeId,
    callbackNames
  );
  const callbackUrls = callbackUrlsArr.reduce((callbackUrlsObj, url, index) => {
    if (url != null) {
      return {
        ...callbackUrlsObj,
        [callbackNames[index].replace(/^yourdata_as\./, '')]: url,
      };
    } else {
      return callbackUrlsObj;
    }
  }, {});
  return callbackUrls;
}

export function getIncomingRequestStatusUpdateCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `yourdata_as.${CALLBACK_URL_NAME.INCOMING_REQUEST_STATUS_UPDATE}`
  );
}

export async function getServiceCallbackUrl(nodeId, serviceId) {
  const serviceInfo = await dataDb.getYourDataASService(nodeId, serviceId);
  if (serviceInfo == null) {
    // FIXME: throw error instead?
    return null;
  }

  return serviceInfo.service_url;
}

//

export async function getServiceDetail(nodeId, serviceId) {
  try {
    if (role === 'proxy') {
      if (nodeId == null) {
        throw new CustomError({
          errorType: errorType.MISSING_NODE_ID,
        });
      }
    } else {
      nodeId = config.nodeId;
    }

    const serviceInfo = await dataDb.getYourDataASService(nodeId, serviceId);

    if (serviceInfo == null) {
      return null;
    }

    return {
      service_id: serviceInfo.service_id,
      service_url: serviceInfo.service_url,
      supported_namespace_list: serviceInfo.supported_namespace_list,
      supported_authorization: serviceInfo.supported_authorization,
      service_availability: serviceInfo.service_availability,
    };
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get YourData service details',
      cause: error,
    });
  }
}

/**
 * Returns false if request is timed out
 * @param {string} requestId
 * @returns {boolean}
 */
export async function isRequestNotTimedOut(nodeId, requestId) {
  const request = await cacheDb.getYourDataRequestData(nodeId, requestId);
  if (request == null) {
    return false;
  }

  const requestTimeoutMsec = request.request_timeout * 1000;
  const requestTimeoutAt = request.request_time + requestTimeoutMsec;
  const timedout = Date.now() > requestTimeoutAt;
  if (timedout) {
    return false;
  }

  return true;
}
