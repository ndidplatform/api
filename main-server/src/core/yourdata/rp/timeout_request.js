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

import { removeTimeoutScheduler } from '../../common/timeout_scheduler';
import * as nodeCallback from '../../node_callback';

import * as tendermintNdid from '../../../tendermint/ndid';
import * as cacheDb from '../../../db/cache';
import { callbackToClient } from '../../../callback';
import * as mq from '../../../mq';
import privateMessageType from '../../../mq/message/type';
import TelemetryLogger from '../../../telemetry';
import logger from '../../../logger';

export async function timeoutRequest(nodeId, requestId) {
  try {
    const request = await cacheDb.getYourDataRequestData(nodeId, requestId);
    if (request == null) {
      throw new CustomError({
        message: 'Request is completed or does not exist',
      });
    }

    const currentRequestStatus = await cacheDb.getYourDataCurrentRequestStatus(
      nodeId,
      requestId
    );

    // request's final state

    // stop timeout timer
    removeTimeoutScheduler(nodeId, requestId);

    // callback to RP app
    const eventDataForCallback = {
      node_id: nodeId,
      type: 'yourdata.request_status',
      requester_node_id: nodeId,
      as_node_id: request.as_node_id,
      request_id: requestId,
      request_timeout: request.request_timeout,
      timed_out: true,
      status: currentRequestStatus,
    };

    const callbackUrl = request.callback_url;
    await callbackToClient({
      callbackUrl,
      body: eventDataForCallback,
      retry: true,
    });

    // remove request data from cache
    await cleanupRequestCachedData({
      nodeId,
      requestId,
      referenceId: request.reference_id,
    });

    // send request status sync to AS
    const asNodeId = request.as_node_id;

    const nodeInfo = await tendermintNdid.getNodeInfo(asNodeId);
    if (nodeInfo == null) {
      throw new CustomError({
        errorType: errorType.NODE_INFO_NOT_FOUND,
        details: {
          request_id: requestId,
          as_node_id: asNodeId,
        },
      });
    }

    let receivers;
    if (nodeInfo.proxy != null) {
      if (nodeInfo.proxy.mq == null || nodeInfo.proxy.mq.length === 0) {
        throw new CustomError({
          errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
          details: {
            request_id: requestId,
            as_node_id: asNodeId,
          },
        });
      }
      receivers = [
        {
          node_id: asNodeId,
          encryption_public_key: nodeInfo.encryption_public_key,
          proxy: {
            node_id: nodeInfo.proxy.node_id,
            encryption_public_key: nodeInfo.proxy.encryption_public_key,
            ip: nodeInfo.proxy.mq[0].ip,
            port: nodeInfo.proxy.mq[0].port,
            config: nodeInfo.proxy.config,
          },
        },
      ];
    } else {
      if (nodeInfo.mq == null || nodeInfo.mq.length === 0) {
        throw new CustomError({
          errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
          details: {
            request_id: requestId,
            as_node_id: asNodeId,
          },
        });
      }
      receivers = [
        {
          node_id: asNodeId,
          encryption_public_key: nodeInfo.encryption_public_key,
          ip: nodeInfo.mq[0].ip,
          port: nodeInfo.mq[0].port,
        },
      ];
    }

    await mq.send({
      receivers,
      message: {
        type: privateMessageType.YOURDATA_STATUS_SYNC,
        request_id: requestId,
        rp_node_id: nodeId,
        status: currentRequestStatus,
        timed_out: true,
      },
      senderNodeId: nodeId,
      onSuccess: ({ mqDestAddress, receiverNodeId }) => {
        // FIXME
        //
        // log request event: AS_SENDS_DATA_TO_RP
        // TelemetryLogger.logRequestEvent(
        //   data.request_id,
        //   nodeId,
        //   REQUEST_EVENTS.AS_SENDS_DATA_TO_RP,
        //   {
        //     service_id: data.service_id,
        //   }
        // );
        //

        nodeCallback.notifyMessageQueueSuccessSend({
          nodeId,
          getCallbackUrlFnName:
            'nodeCallback.getMessageQueueSendSuccessCallbackUrl',
          destNodeId: receiverNodeId,
          destIp: mqDestAddress.ip,
          destPort: mqDestAddress.port,
          requestId,
        });
      },
    });
  } catch (error) {
    logger.error({
      message: 'Cannot timeout request',
      requestId,
      err: error,
    });
    throw error;
  }
}
