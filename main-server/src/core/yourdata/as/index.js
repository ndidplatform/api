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

import * as tendermintNdid from '../../../tendermint/ndid';
import * as dataDb from '../../../db/data';

import logger from '../../../logger';

import * as config from '../../../config';
import { role } from '../../../node';

const CALLBACK_URL_NAME = {
  INCOMING_REQUEST_STATUS_UPDATE: 'incoming_request_status_update_url',
  ERROR: 'error_url',
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

export async function setCallbackUrls({
  incoming_request_status_update_url,
  error_url,
}) {
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
  if (error_url != null) {
    promises.push(
      dataDb.setCallbackUrl(
        config.nodeId,
        `yourdata_as.${CALLBACK_URL_NAME.ERROR}`,
        error_url
      )
    );
  }
  await Promise.all(promises);
}

export async function getCallbackUrls() {
  const callbackNames = CALLBACK_URL_NAME_ARR.map((name) => `as.${name}`);
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

export function getErrorCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `yourdata_as.${CALLBACK_URL_NAME.ERROR}`
  );
}

export function getIncomingRequestStatusUpdateCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `yourdata_as.${CALLBACK_URL_NAME.INCOMING_REQUEST_STATUS_UPDATE}`
  );
}

export function setServiceCallbackUrl(nodeId, serviceId, url) {
  return dataDb.setCallbackUrl(nodeId, `yourdata_service-${serviceId}`, url);
}

export function getServiceCallbackUrl(nodeId, serviceId) {
  return dataDb.getCallbackUrl(nodeId, `yourdata_service-${serviceId}`);
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

    // TODO

    // const services = await tendermintNdid.getServicesByAsID({
    //   as_id: nodeId,
    // });
    // const service = services.find((service) => {
    //   return service.service_id === service_id;
    // });
    // if (service == null) return null;
    // return {
    //   url: await getServiceCallbackUrl(nodeId, service_id),
    //   supported_namespace_list: service.supported_namespace_list,
    //   min_ial: service.min_ial,
    //   min_aal: service.min_aal,
    //   active: service.active,
    //   suspended: service.suspended,
    // };
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get YourData service details',
      cause: error,
    });
  }
}
