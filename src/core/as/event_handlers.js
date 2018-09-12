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

import { callbackUrls, processRequest } from '.';

import CustomError from '../../error/custom_error';
import logger from '../../logger';

import * as tendermint from '../../tendermint';
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../private_message_type';

const requestIdLocks = {};

export async function handleMessageFromQueue(message) {
  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    messageJSON: message,
  });

  const requestId = message.request_id;
  try {
    if (message.type === privateMessageType.DATA_REQUEST) {
      await cacheDb.setInitialSalt(message.request_id, message.initial_salt);
      const latestBlockHeight = tendermint.latestBlockHeight;
      if (latestBlockHeight <= message.height) {
        logger.debug({
          message: 'Saving message from MQ',
          tendermintLatestBlockHeight: latestBlockHeight,
          messageBlockHeight: message.height,
        });
        requestIdLocks[message.request_id] = true;
        await Promise.all([
          cacheDb.setRequestReceivedFromMQ(message.request_id, message),
          cacheDb.addRequestIdExpectedInBlock(
            message.height,
            message.request_id
          ),
        ]);
        if (tendermint.latestBlockHeight <= message.height) {
          delete requestIdLocks[message.request_id];
          return;
        } else {
          await cacheDb.removeRequestReceivedFromMQ(requestId);
        }
      }

      await processRequest(message);
      delete requestIdLocks[message.request_id];
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling message from message queue',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      callbackUrl: callbackUrls.error_url,
      action: 'handleMessageFromQueue',
      error: err,
      requestId,
    });
  }
}

export async function handleTendermintNewBlock(
  error,
  height,
  missingBlockCount
) {
  if (missingBlockCount == null) return;
  try {
    // messages that arrived before 'NewBlock' event
    // including messages between the start of missing block's height
    // and the block before latest block height
    // (not only just (current height - 1) in case 'NewBlock' events are missing)
    // NOTE: tendermint always create a pair of block. A block with transactions and
    // a block that signs the previous block which indicates that the previous block is valid
    const fromHeight = height - 1 - missingBlockCount;
    const toHeight = height - 1;

    logger.debug({
      message: 'Getting request IDs to process',
      fromHeight,
      toHeight,
    });

    const requestIdsInTendermintBlock = await cacheDb.getRequestIdsExpectedInBlock(
      fromHeight,
      toHeight
    );
    await Promise.all(
      requestIdsInTendermintBlock.map(async (requestId) => {
        if (requestIdLocks[requestId]) return;
        const request = await cacheDb.getRequestReceivedFromMQ(requestId);
        if (request == null) return;
        await processRequest(request);
        await cacheDb.removeRequestReceivedFromMQ(requestId);
      })
    );

    cacheDb.removeRequestIdsExpectedInBlock(fromHeight, toHeight);
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling Tendermint NewBlock event',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      callbackUrl: callbackUrls.error_url,
      action: 'handleTendermintNewBlock',
      error: err,
    });
  }
}
