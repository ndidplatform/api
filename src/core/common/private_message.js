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

import * as tendermintNdid from '../../tendermint/ndid';
import * as longTermDb from '../../db/long_term';
import PRIVATE_MESSAGE_TYPES from '../private_message_type';

import CustomError from '../../error/custom_error';
import errorType from '../../error/type';

import { role } from '../../node';
import * as config from '../../config';

const privateMessageTypes = Object.values(PRIVATE_MESSAGE_TYPES);

export async function getPrivateMessages({ nodeId, requestId, type } = {}) {
  if (role === 'proxy' && nodeId == null) {
    throw new CustomError({
      errorType: errorType.MISSING_NODE_ID,
    });
  }

  if (nodeId == null) {
    nodeId = config.nodeId;
  }

  try {
    if (requestId == null) {
      if (type == null) {
        const allTypesMessages = await Promise.all(
          privateMessageTypes.map(async (type) => {
            const [inboundMessages, outboundMessages] = await Promise.all([
              longTermDb.getAllMessages(
                nodeId,
                longTermDb.MESSAGE_DIRECTIONS.INBOUND,
                type
              ),
              longTermDb.getAllMessages(
                nodeId,
                longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
                type
              ),
            ]);
            return [...inboundMessages, ...outboundMessages];
          })
        );
        return allTypesMessages.reduce(
          (result, messages) => result.concat(messages),
          []
        );
      } else {
        const [inboundMessages, outboundMessages] = await Promise.all([
          longTermDb.getAllMessages(
            nodeId,
            longTermDb.MESSAGE_DIRECTIONS.INBOUND,
            type
          ),
          longTermDb.getAllMessages(
            nodeId,
            longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
            type
          ),
        ]);
        return [...inboundMessages, ...outboundMessages];
      }
    } else {
      const request = await tendermintNdid.getRequest({ requestId });
      if (request == null) {
        return null;
      }
      if (type == null) {
        const allTypesMessages = await Promise.all(
          privateMessageTypes.map(async (type) => {
            const [inboundMessages, outboundMessages] = await Promise.all([
              longTermDb.getMessages(
                nodeId,
                longTermDb.MESSAGE_DIRECTIONS.INBOUND,
                type,
                requestId
              ),
              longTermDb.getMessages(
                nodeId,
                longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
                type,
                requestId
              ),
            ]);
            return [...inboundMessages, ...outboundMessages];
          })
        );
        return allTypesMessages.reduce(
          (result, messages) => result.concat(messages),
          []
        );
      } else {
        const [inboundMessages, outboundMessages] = await Promise.all([
          longTermDb.getMessages(
            nodeId,
            longTermDb.MESSAGE_DIRECTIONS.INBOUND,
            type,
            requestId
          ),
          longTermDb.getMessages(
            nodeId,
            longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
            type,
            requestId
          ),
        ]);
        return [...inboundMessages, ...outboundMessages];
      }
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get private messages (from message queue)',
      details: {
        requestId,
        type,
      },
      cause: error,
    });
  }
}

export async function removePrivateMessages({ nodeId, requestId, type } = {}) {
  if (role === 'proxy' && nodeId == null) {
    throw new CustomError({
      errorType: errorType.MISSING_NODE_ID,
    });
  }

  if (nodeId == null) {
    nodeId = config.nodeId;
  }

  try {
    if (requestId == null) {
      if (type == null) {
        await Promise.all(
          privateMessageTypes.map(async (type) => {
            return Promise.all([
              longTermDb.removeAllMessages(
                nodeId,
                longTermDb.MESSAGE_DIRECTIONS.INBOUND,
                type
              ),
              longTermDb.removeAllMessages(
                nodeId,
                longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
                type
              ),
            ]);
          })
        );
      } else {
        await Promise.all([
          longTermDb.removeAllMessages(
            nodeId,
            longTermDb.MESSAGE_DIRECTIONS.INBOUND,
            type
          ),
          longTermDb.removeAllMessages(
            nodeId,
            longTermDb.MESSAGE_DIRECTIONS.OUTBOUND,
            type
          ),
        ]);
      }
    } else {
      if (type == null) {
        await Promise.all(
          privateMessageTypes.map(async (type) => {
            longTermDb.removeMessages(
              nodeId,
              longTermDb.MESSAGE_DIRECTIONS.INBOUND,
              type,
              requestId
            );
          })
        );
      } else {
        await longTermDb.removeMessages(
          nodeId,
          longTermDb.MESSAGE_DIRECTIONS.INBOUND,
          type,
          requestId
        );
      }
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot remove private messages (from message queue)',
      details: {
        requestId,
        type,
      },
      cause: error,
    });
  }
}
