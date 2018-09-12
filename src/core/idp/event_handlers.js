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

import { callbackUrls, processMessage } from '.';
import { createResponse } from './create_response';

import { callbackToClient } from '../../utils/callback';
import CustomError from '../../error/custom_error';
import { getErrorObjectForClient } from '../../error/helpers';
import logger from '../../logger';

import * as tendermint from '../../tendermint';
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../private_message_type';

const successBase64 = Buffer.from('success').toString('base64');
const trueBase64 = Buffer.from('true').toString('base64');

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
    //if message is challenge for response, no need to wait for blockchain
    if (message.type === privateMessageType.CHALLENGE_RESPONSE) {
      //store challenge
      const data = await cacheDb.getResponseFromRequestId(message.request_id);
      try {
        let request = await cacheDb.getRequestReceivedFromMQ(
          message.request_id
        );
        request.challenge = message.challenge;
        logger.debug({
          message: 'Save challenge to request',
          request,
          challenge: message.challenge,
        });
        await cacheDb.setRequestReceivedFromMQ(message.request_id, request);
        //query reponse data
        logger.debug({
          message: 'Data to response',
          data,
        });
        await createResponse(data);
      } catch (error) {
        await callbackToClient(
          data.callback_url,
          {
            type: 'response_result',
            success: false,
            reference_id: data.reference_id,
            request_id: data.request_id,
            error: getErrorObjectForClient(error),
          },
          true
        );
        cacheDb.removeResponseFromRequestId(data.request_id);
      }
      return;
    } else {
      if (message.type === privateMessageType.CONSENT_REQUEST) {
        await Promise.all([
          cacheDb.setRequestReceivedFromMQ(message.request_id, message),
          cacheDb.setRPIdFromRequestId(message.request_id, message.rp_id),
        ]);

        const latestBlockHeight = tendermint.latestBlockHeight;
        if (latestBlockHeight <= message.height) {
          logger.debug({
            message: 'Saving consent request message from MQ',
            tendermintLatestBlockHeight: latestBlockHeight,
            messageBlockHeight: message.height,
          });
          requestIdLocks[message.request_id] = true;
          await Promise.all([
            cacheDb.setRequestToProcessReceivedFromMQ(
              message.request_id,
              message
            ),
            cacheDb.addRequestIdExpectedInBlock(
              message.height,
              message.request_id
            ),
          ]);
          if (tendermint.latestBlockHeight <= message.height) {
            delete requestIdLocks[message.request_id];
            return;
          } else {
            await cacheDb.removeRequestToProcessReceivedFromMQ(
              message.request_id
            );
          }
        }
      } else if (message.type === privateMessageType.CHALLENGE_REQUEST) {
        const latestBlockHeight = tendermint.latestBlockHeight;
        if (latestBlockHeight <= message.height) {
          logger.debug({
            message: 'Saving challege request message from MQ',
            tendermintLatestBlockHeight: latestBlockHeight,
            messageBlockHeight: message.height,
          });
          const responseId = message.request_id + ':' + message.idp_id;
          requestIdLocks[message.request_id] = true;
          await Promise.all([
            cacheDb.setRequestToProcessReceivedFromMQ(
              message.request_id,
              message
            ),
            cacheDb.addRequestIdExpectedInBlock(
              message.height,
              message.request_id
            ),
            cacheDb.setPublicProofReceivedFromMQ(
              responseId,
              message.public_proof
            ),
          ]);
          if (tendermint.latestBlockHeight <= message.height) {
            delete requestIdLocks[message.request_id];
            return;
          } else {
            await Promise.all([
              cacheDb.removeRequestToProcessReceivedFromMQ(message.request_id),
              cacheDb.removePublicProofReceivedFromMQ(responseId),
            ]);
          }
        }
      } else if (message.type === privateMessageType.IDP_RESPONSE) {
        const request = await cacheDb.getRequestData(message.request_id);
        if (request) {
          if (request.privateProofObjectList) {
            request.privateProofObjectList.push({
              idp_id: message.idp_id,
              privateProofObject: {
                privateProofValue: message.privateProofValue,
                accessor_id: message.accessor_id,
                padding: message.padding,
              },
            });
          } else {
            request.privateProofObjectList = [
              {
                idp_id: message.idp_id,
                privateProofObject: {
                  privateProofValue: message.privateProofValue,
                  accessor_id: message.accessor_id,
                  padding: message.padding,
                },
              },
            ];
          }
          await cacheDb.setRequestData(message.request_id, request);
        }

        const latestBlockHeight = tendermint.latestBlockHeight;
        if (latestBlockHeight <= message.height) {
          logger.debug({
            message: 'Saving IdP response message from MQ',
            tendermintLatestBlockHeight: latestBlockHeight,
            messageBlockHeight: message.height,
          });
          requestIdLocks[message.request_id] = true;
          await Promise.all([
            cacheDb.setRequestToProcessReceivedFromMQ(
              message.request_id,
              message
            ),
            cacheDb.addRequestIdExpectedInBlock(
              message.height,
              message.request_id
            ),
          ]);
          if (tendermint.latestBlockHeight <= message.height) {
            delete requestIdLocks[message.request_id];
            return;
          } else {
            await cacheDb.removeRequestToProcessReceivedFromMQ(
              message.request_id
            );
          }
        }
      }
    }

    await processMessage(message);
    delete requestIdLocks[message.request_id];
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
        const message = await cacheDb.getRequestToProcessReceivedFromMQ(
          requestId
        );
        if (message == null) return;
        await processMessage(message);
        await cacheDb.removeRequestToProcessReceivedFromMQ(requestId);
      })
    );
    cacheDb.removeRequestIdsExpectedInBlock(fromHeight, toHeight);

    // Clean up closed or timed out create identity requests
    const blocks = await tendermint.getBlocks(fromHeight, toHeight);
    await Promise.all(
      blocks.map(async (block, blockIndex) => {
        let transactions = tendermint.getTransactionListFromBlock(block);
        if (transactions.length === 0) return;

        let requestIdsToCleanUp = await Promise.all(
          transactions.map(async (transaction) => {
            const requestId = transaction.args.request_id;
            if (requestId == null) return;
            if (
              transaction.fnName === 'CloseRequest' ||
              transaction.fnName === 'TimeOutRequest'
            ) {
              const callbackUrl = await cacheDb.getRequestCallbackUrl(
                requestId
              );
              if (!callbackUrl) return;
              return requestId;
            }
          })
        );
        const requestIdsToCleanUpWithValue = requestIdsToCleanUp.filter(
          (requestId) => requestId != null
        );
        if (requestIdsToCleanUpWithValue.length === 0) return;

        const height = parseInt(block.header.height);
        const blockResults = await tendermint.getBlockResults(height, height);
        requestIdsToCleanUp.filter((requestId, index) => {
          const deliverTxResult =
            blockResults[blockIndex].results.DeliverTx[index];
          const successTag = deliverTxResult.tags.find(
            (tag) => tag.key === successBase64
          );
          if (successTag) {
            return successTag.value === trueBase64;
          }
          return false;
        });

        requestIdsToCleanUp = [...new Set(requestIdsToCleanUp)];

        await Promise.all(
          requestIdsToCleanUp.map(async (requestId) => {
            cacheDb.removeRequestCallbackUrl(requestId);
            cacheDb.removeRequestIdReferenceIdMappingByRequestId(requestId);
            cacheDb.removeRequestData(requestId);
            cacheDb.removeIdpResponseValidList(requestId);
            cacheDb.removeTimeoutScheduler(requestId);
          })
        );
      })
    );
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
