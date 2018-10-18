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
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import logger from '../../logger';

import * as tendermint from '../../tendermint';
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import privateMessageType from '../private_message_type';

import * as config from '../../config';
import * as tendermintNdid from '../../tendermint/ndid';

const requestIdLocks = {};

export async function handleMessageFromQueue(message, nodeId = config.nodeId) {
  logger.info({
    message: 'Received message from MQ',
    nodeId,
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
      const createResponseParams = await cacheDb.getResponseFromRequestId(
        nodeId,
        message.request_id
      );
      try {
        let request = await cacheDb.getRequestReceivedFromMQ(
          nodeId,
          message.request_id
        );
        request.challenge = message.challenge;
        logger.debug({
          message: 'Save challenge to request',
          request,
          challenge: message.challenge,
        });
        await cacheDb.setRequestReceivedFromMQ(
          nodeId,
          message.request_id,
          request
        );
        //query reponse data
        logger.debug({
          message: 'Data to response',
          createResponseParams,
        });
        await createResponse(createResponseParams, { nodeId });
      } catch (error) {
        await callbackToClient(
          createResponseParams.callback_url,
          {
            node_id: nodeId,
            type: 'response_result',
            success: false,
            reference_id: createResponseParams.reference_id,
            request_id: createResponseParams.request_id,
            error: getErrorObjectForClient(error),
          },
          true
        );
        cacheDb.removeResponseFromRequestId(
          nodeId,
          createResponseParams.request_id
        );
      }
      return;
    } else {
      if (message.type === privateMessageType.CONSENT_REQUEST) {
        await Promise.all([
          cacheDb.setRequestReceivedFromMQ(nodeId, message.request_id, message),
          cacheDb.setRPIdFromRequestId(
            nodeId,
            message.request_id,
            message.rp_id
          ),
        ]);

        const latestBlockHeight = tendermint.latestBlockHeight;
        if (latestBlockHeight <= message.height) {
          logger.debug({
            message: 'Saving consent request message from MQ',
            tendermintLatestBlockHeight: latestBlockHeight,
            messageBlockHeight: message.height,
          });
          requestIdLocks[nodeId + ':' + message.request_id] = true;
          await Promise.all([
            cacheDb.setRequestToProcessReceivedFromMQ(
              nodeId,
              message.request_id,
              message
            ),
            cacheDb.addRequestIdExpectedInBlock(
              nodeId,
              message.height,
              message.request_id
            ),
          ]);
          if (tendermint.latestBlockHeight <= message.height) {
            delete requestIdLocks[nodeId + ':' + message.request_id];
            return;
          } else {
            await cacheDb.removeRequestToProcessReceivedFromMQ(
              nodeId,
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
          const responseId =
            nodeId + ':' + message.request_id + ':' + message.idp_id;
          requestIdLocks[nodeId + ':' + message.request_id] = true;
          await Promise.all([
            cacheDb.setRequestToProcessReceivedFromMQ(
              nodeId,
              message.request_id,
              message
            ),
            cacheDb.addRequestIdExpectedInBlock(
              nodeId,
              message.height,
              message.request_id
            ),
            cacheDb.setPublicProofReceivedFromMQ(
              nodeId,
              responseId,
              message.public_proof
            ),
          ]);
          if (tendermint.latestBlockHeight <= message.height) {
            delete requestIdLocks[nodeId + ':' + message.request_id];
            return;
          } else {
            await Promise.all([
              cacheDb.removeRequestToProcessReceivedFromMQ(
                nodeId,
                message.request_id
              ),
              cacheDb.removePublicProofReceivedFromMQ(nodeId, responseId),
            ]);
          }
        }
      } else if (message.type === privateMessageType.IDP_RESPONSE) {
        const request = await cacheDb.getRequestData(
          nodeId,
          message.request_id
        );
        if (!request) return; //request not found
        await cacheDb.addPrivateProofObjectInRequest(
          nodeId,
          message.request_id,
          {
            idp_id: message.idp_id,
            privateProofObject: {
              privateProofValue: message.privateProofValueArray,
              accessor_id: message.accessor_id,
              padding: message.padding,
            },
          }
        );

        const latestBlockHeight = tendermint.latestBlockHeight;
        if (latestBlockHeight <= message.height) {
          logger.debug({
            message: 'Saving IdP response message from MQ',
            tendermintLatestBlockHeight: latestBlockHeight,
            messageBlockHeight: message.height,
          });
          requestIdLocks[nodeId + ':' + message.request_id] = true;
          await Promise.all([
            cacheDb.setRequestToProcessReceivedFromMQ(
              nodeId,
              message.request_id,
              message
            ),
            cacheDb.addRequestIdExpectedInBlock(
              nodeId,
              message.height,
              message.request_id
            ),
          ]);
          if (tendermint.latestBlockHeight <= message.height) {
            delete requestIdLocks[nodeId + ':' + message.request_id];
            return;
          } else {
            await cacheDb.removeRequestToProcessReceivedFromMQ(
              nodeId,
              message.request_id
            );
          }
        }
      }
    }

    await processMessage(nodeId, message);
    delete requestIdLocks[nodeId + ':' + message.request_id];
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling message from message queue',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      nodeId,
      callbackUrl: callbackUrls.error_url,
      action: 'handleMessageFromQueue',
      error: err,
      requestId,
    });
  }
}

export async function handleTendermintNewBlock(
  fromHeight,
  toHeight,
  parsedTransactionsInBlocks,
  nodeId = config.nodeId
) {
  logger.debug({
    message: 'Handling Tendermint new blocks',
    nodeId,
    fromHeight,
    toHeight,
  });

  try {
    await Promise.all([
      processMessageExptectedInBlocks(fromHeight, toHeight, nodeId),
      processTasksInBlocks(parsedTransactionsInBlocks, nodeId),
    ]);
  } catch (error) {
    const err = new CustomError({
      message: 'Error handling Tendermint NewBlock event',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    await common.notifyError({
      nodeId,
      callbackUrl: callbackUrls.error_url,
      action: 'handleTendermintNewBlock',
      error: err,
    });
  }
}

async function processMessageExptectedInBlocks(fromHeight, toHeight, nodeId) {
  const requestIdsInTendermintBlock = await cacheDb.getRequestIdsExpectedInBlock(
    nodeId,
    fromHeight,
    toHeight
  );
  await Promise.all(
    requestIdsInTendermintBlock.map(async (requestId) => {
      if (requestIdLocks[nodeId + ':' + requestId]) return;
      const message = await cacheDb.getRequestToProcessReceivedFromMQ(
        nodeId,
        requestId
      );
      if (message == null) return;
      await processMessage(nodeId, message);
      await cacheDb.removeRequestToProcessReceivedFromMQ(nodeId, requestId);
    })
  );
  cacheDb.removeRequestIdsExpectedInBlock(nodeId, fromHeight, toHeight);
}

async function isCreateIdentityRequestValid(requestId) {
  const requestDetail = await tendermintNdid.getRequestDetail({ requestId });

  if (requestDetail.response_list.length !== requestDetail.min_idp) {
    return false;
  }

  return requestDetail.response_list
    .map(({ valid_proof, valid_ial, valid_signature }) => {
      return valid_proof && valid_ial && valid_signature;
    })
    .reduce((accum, pilot) => {
      return accum && pilot;
    }, true);
}

async function processTasksInBlocks(parsedTransactionsInBlocks, nodeId) {
  const transactionsInBlocksToProcess = parsedTransactionsInBlocks.filter(
    ({ transactions }) => transactions.length >= 0
  );

  await Promise.all(
    transactionsInBlocksToProcess.map(async ({ transactions }) => {
      // Clean up closed or timed out create identity requests
      const requestIdsToCleanUpSet = new Set();
      const closedRequestIds = new Set();
      const timedOutRequestIds = new Set();
      const validResponseRequestIds = new Set();
      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        const requestId = transaction.args.request_id;
        if (requestId == null) return;
        if (transaction.fnName === 'CloseRequest') {
          requestIdsToCleanUpSet.add(requestId);
          closedRequestIds.add(requestId);
          //check validResponse
          if (await isCreateIdentityRequestValid(requestId)) {
            validResponseRequestIds.add(requestId);
          }
        }
        if (transaction.fnName === 'TimeOutRequest') {
          requestIdsToCleanUpSet.add(requestId);
          timedOutRequestIds.add(requestId);
        }
      }
      const requestIdsToCleanUp = [...requestIdsToCleanUpSet];

      await Promise.all(
        requestIdsToCleanUp.map(async (requestId) => {
          // When IdP act as an RP (create identity)
          const callbackUrl = await cacheDb.getRequestCallbackUrl(
            nodeId,
            requestId
          );
          if (callbackUrl != null) {
            const referenceId = await cacheDb.getReferenceIdByRequestId(
              nodeId,
              requestId
            );
            const identityCallbackUrl = await cacheDb.getCallbackUrlByReferenceId(
              nodeId,
              referenceId
            );

            let identityPromise, type;

            if (identityCallbackUrl != null) {
              let identityError;
              if (closedRequestIds.has(requestId)) {
                if (validResponseRequestIds.has(requestId)) return;
                identityError = new CustomError({
                  errorType: errorType.REQUEST_IS_CLOSED,
                });
              } else if (timedOutRequestIds.has(requestId)) {
                identityError = new CustomError({
                  errorType: errorType.REQUEST_IS_TIMED_OUT,
                });
              }

              //check type
              if(await cacheDb.getCreateIdentityDataByReferenceId(nodeId, referenceId)) {
                type = 'create_identity_result';
                identityPromise = cacheDb.removeCreateIdentityDataByReferenceId(
                  nodeId,
                  referenceId
                );
              } else if(await cacheDb.getRevokeAccessorDataByReferenceId(nodeId, referenceId)) {
                type = 'revoke_accessor_result';
                identityPromise = cacheDb.removeRevokeAccessorDataByReferenceId(
                  nodeId,
                  referenceId
                );
              }

              await callbackToClient(
                identityCallbackUrl,
                {
                  node_id: nodeId,
                  type,
                  success: false,
                  reference_id: referenceId,
                  request_id: requestId,
                  error: getErrorObjectForClient(identityError),
                },
                true
              );
            }

            await Promise.all([
              cacheDb.removeRequestCallbackUrl(nodeId, requestId),
              cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
              cacheDb.removeReferenceIdByRequestId(nodeId, requestId),
              cacheDb.removeRequestData(nodeId, requestId),
              cacheDb.removePrivateProofObjectListInRequest(nodeId, requestId),
              cacheDb.removeIdpResponseValidList(nodeId, requestId),
              cacheDb.removeTimeoutScheduler(nodeId, requestId),
              identityPromise,
              cacheDb.removeIdentityFromRequestId(nodeId, requestId),
            ]);
          }

          // Clean up when request is timed out or closed before IdP response
          const requestReceivedFromMQ = await cacheDb.getRequestReceivedFromMQ(
            nodeId,
            requestId
          );
          if (requestReceivedFromMQ != null) {
            await Promise.all([
              cacheDb.removeRequestReceivedFromMQ(nodeId, requestId),
              cacheDb.removeRPIdFromRequestId(nodeId, requestId),
              cacheDb.removeRequestMessage(nodeId, requestId),
            ]);
          }
        })
      );
    })
  );
}
