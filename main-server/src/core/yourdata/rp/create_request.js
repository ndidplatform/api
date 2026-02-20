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

import { cleanupRequestCachedData } from '.';

import { validateAuthorization } from '../authorization_token';
import yourDataRequestStatus from '../request_status';
import {
  setTimeoutScheduler,
  removeTimeoutScheduler,
} from '../../common/timeout_scheduler';
import domain from '../../domain';
import * as nodeCallback from '../../node_callback';

import * as tendermintNdid from '../../../tendermint/ndid';
import * as cacheDb from '../../../db/cache';
import * as mq from '../../../mq';
import privateMessageType from '../../../mq/message/type';
import { callbackToClient } from '../../../callback';
import * as utils from '../../../utils';
import * as jwtUtils from '../../../utils/jwt';
import TelemetryLogger from '../../../telemetry';
import logger from '../../../logger';

import * as config from '../../../config';
import { role } from '../../../node';

export async function createRequest(createRequestParams) {
  let { node_id } = createRequestParams;
  const {
    service_id,
    service_version,
    service_extension,
    as_node_id: asNodeId,
    reference_id,
    callback_url,
    namespace,
    identifier,
    request_params,
    authorization,
    request_timeout,
  } = createRequestParams;

  if (role === 'proxy') {
    if (node_id == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    node_id = config.nodeId;
  }

  let requestId;

  try {
    // validations

    // check (active) duplicate reference ID from cache
    const existingRequestId = await cacheDb.getYourDataRequestIdByReferenceId(
      node_id,
      reference_id
    );
    if (existingRequestId) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_REFERENCE_ID,
      });
    }

    // check self RP node ID
    // - active
    // - in whitelist (if whitelist is active/in-use)
    const nodeInfo = await tendermintNdid.getNodeInfo(node_id);
    if (!nodeInfo.active) {
      throw new CustomError({
        errorType: errorType.NODE_IS_NOT_ACTIVE,
        details: {
          node_id,
        },
      });
    }

    const nodeDomainPermission = await tendermintNdid.getDomainNodePermission({
      nodeId: node_id,
      domain: domain.YOURDATA,
    });
    if (!nodeDomainPermission.allowed) {
      throw new CustomError({
        errorType: errorType.NO_DOMAIN_PERMISSION,
        details: {
          node_id,
        },
      });
    }

    // check destination AS node ID
    // - exists / valid
    // - active
    // - in whitelist (if whitelist is active/in-use)
    const asNodeInfo = await tendermintNdid.getNodeInfo(asNodeId);
    if (asNodeInfo == null) {
      throw new CustomError({
        errorType: errorType.NODE_INFO_NOT_FOUND,
        details: {
          asNodeId,
        },
      });
    }
    if (!asNodeInfo.active) {
      throw new CustomError({
        errorType: errorType.NODE_IS_NOT_ACTIVE,
        details: {
          asNodeId,
        },
      });
    }

    const asNodeDomainPermission = await tendermintNdid.getDomainNodePermission(
      {
        nodeId: asNodeId,
        domain: domain.YOURDATA,
      }
    );
    if (!asNodeDomainPermission.allowed) {
      throw new CustomError({
        errorType: errorType.AS_NODE_NO_DOMAIN_PERMISSION,
        details: {
          asNodeId,
        },
      });
    }

    // validate data in "authorization"
    //
    // parse "authorization" JWT payload for subsequent checks
    const parsedJwt = jwtUtils.parseJWT(authorization);

    await validateAuthorization({
      parsedAuthorizationTokenPayload: parsedJwt.payload,
      rpNodeId: node_id,
      asNodeId,
      namespace,
      identifier,
      serviceId: service_id,
      serviceExtension: service_extension,
    });

    // --- end of validations ---

    // generate request ID
    requestId = utils.createRequestId();

    const requestTime = Date.now();

    // save data to cache
    const requestData = {
      request_id: requestId,
      service_id,
      service_version,
      service_extension,
      requester_node_id: node_id,
      as_node_id: asNodeId,
      namespace,
      identifier,
      request_params,
      authorization,
      request_time: requestTime,
      request_timeout,
      reference_id,
      callback_url,
    };

    await Promise.all([
      cacheDb.setYourDataRequestData(node_id, requestId, requestData),
      cacheDb.setYourDataRequestIdByReferenceId(
        node_id,
        reference_id,
        requestId
      ),
    ]);

    // set timeout
    await setTimeoutScheduler({
      nodeId: node_id,
      requestId,
      domain: 'yourdata',
      secondsToTimeout: request_timeout,
    });

    // send request to AS via MQ

    let receivers;
    if (asNodeInfo.proxy != null) {
      if (asNodeInfo.proxy.mq == null || asNodeInfo.proxy.mq.length === 0) {
        throw new CustomError({
          errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
          details: {
            asNodeId,
          },
        });
      }
      receivers = [
        {
          node_id: asNodeId,
          encryption_public_key: asNodeInfo.encryption_public_key,
          proxy: {
            node_id: asNodeInfo.proxy.node_id,
            encryption_public_key: asNodeInfo.proxy.encryption_public_key,
            ip: asNodeInfo.proxy.mq[0].ip,
            port: asNodeInfo.proxy.mq[0].port,
            config: asNodeInfo.proxy.config,
          },
        },
      ];
    } else {
      if (asNodeInfo.mq == null || asNodeInfo.mq.length === 0) {
        throw new CustomError({
          errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
          details: {
            asNodeId,
          },
        });
      }
      receivers = [
        {
          node_id: asNodeId,
          encryption_public_key: asNodeInfo.encryption_public_key,
          ip: asNodeInfo.mq[0].ip,
          port: asNodeInfo.mq[0].port,
        },
      ];
    }

    const mqMessage = {
      type: privateMessageType.YOURDATA_DATA_REQUEST,
      request_id: requestId,
      service_id,
      service_version,
      service_extension,
      rp_node_id: node_id,
      namespace,
      identifier,
      request_params,
      authorization,
      request_time: requestTime,
      request_timeout,
    };
    await mq.send({
      receivers,
      message: mqMessage,
      senderNodeId: node_id,
      onSuccess: ({ mqDestAddress, receiverNodeId }) => {
        // FIXME
        //
        // TelemetryLogger.logRequestEvent(
        //   request_id,
        //   node_id,
        //   REQUEST_EVENTS.RP_SENDS_REQUEST_TO_IDP,
        //   {
        //     as_node_id: receiverNodeId,
        //   }
        // );

        nodeCallback.notifyMessageQueueSuccessSend({
          nodeId: node_id,
          getCallbackUrlFnName:
            'nodeCallback.getMessageQueueSendSuccessCallbackUrl',
          destNodeId: receiverNodeId,
          destIp: mqDestAddress.ip,
          destPort: mqDestAddress.port,
          requestId,
        });
      },
    });

    // request status update
    // status: "pending"

    await cacheDb.setYourDataCurrentRequestStatus(
      node_id,
      requestId,
      yourDataRequestStatus.PENDING
    );

    // TODO: move to onSuccess on mq.send() ?
    // callback to RP app
    callbackStatusUpdatePending({
      nodeId: node_id,
      callbackUrl: callback_url,
      asNodeId,
      requestId,
      requestTimeout: request_timeout,
    });

    return {
      request_id: requestId,
    };
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create request',
      cause: error,
    });
    logger.error({ err });

    if (requestId) {
      await removeTimeoutScheduler(node_id, requestId);

      await cleanupRequestCachedData({
        nodeId: node_id,
        requestId,
        referenceId: reference_id,
      });
    }

    throw err;
  }
}

async function callbackStatusUpdatePending({
  nodeId,
  callbackUrl,
  asNodeId,
  requestId,
  requestTimeout,
}) {
  const eventDataForCallback = {
    node_id: nodeId,
    type: 'yourdata.request_status',
    requester_node_id: nodeId,
    as_node_id: asNodeId,
    request_id: requestId,
    request_timeout: requestTimeout,
    timed_out: false,
    status: yourDataRequestStatus.PENDING,
  };

  await callbackToClient({
    callbackUrl,
    body: eventDataForCallback,
    retry: true,
  });
}
