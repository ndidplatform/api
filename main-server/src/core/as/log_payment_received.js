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
import logger from '../../logger';
import TelemetryLogger, { REQUEST_EVENTS } from '../../telemetry';

import * as tendermintNdid from '../../tendermint/ndid';
import * as config from '../../config';

import { role } from '../../node';

export async function logPaymentReceived(
  logPaymentReceivedParams,
  { apiVersion, ndidMemberAppType, ndidMemberAppVersion } = {}
) {
  let { node_id } = logPaymentReceivedParams;
  const { requestId, serviceId } = logPaymentReceivedParams;

  if (role === 'proxy') {
    if (node_id == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    node_id = config.nodeId;
  }

  try {
    const requestDetail = await tendermintNdid.getRequestDetail({
      requestId,
    });
    if (requestDetail == null) {
      throw new CustomError({
        errorType: errorType.REQUEST_NOT_FOUND,
        details: {
          requestId,
        },
      });
    }
    // if (requestDetail.closed) {
    //   throw new CustomError({
    //     errorType: errorType.REQUEST_IS_CLOSED,
    //     details: {
    //       requestId,
    //     },
    //   });
    // }
    // if (requestDetail.timed_out) {
    //   throw new CustomError({
    //     errorType: errorType.REQUEST_IS_TIMED_OUT,
    //     details: {
    //       requestId,
    //     },
    //   });
    // }

    // Check if there is an input service ID in the request
    const serviceInRequest = requestDetail.data_request_list.find(
      (dataRequest) => dataRequest.service_id === serviceId
    );
    if (serviceInRequest == null) {
      throw new CustomError({
        errorType: errorType.SERVICE_ID_NOT_FOUND_IN_REQUEST,
      });
    }

    // log request event: AS_RECEIVES_PAYMENT
    TelemetryLogger.logRequestEvent(
      requestId,
      node_id,
      REQUEST_EVENTS.AS_RECEIVES_PAYMENT,
      {
        service_id: serviceId,
        api_spec_version: apiVersion,
        ndid_member_app_type: ndidMemberAppType,
        ndid_member_app_version: ndidMemberAppVersion,
      }
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot log payment received',
      cause: error,
      details: {
        requestId,
        serviceId,
      },
    });
    logger.error({ err });
    throw err;
  }
}
