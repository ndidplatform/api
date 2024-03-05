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

import { getFunction } from '../../functions';
import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';
import * as utils from '../../utils';
import * as cryptoUtils from '../../utils/crypto';
import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';

import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

/**
 * Create a new message
 *
 * @param {Object} createMessageParams
 * @param {string} createMessageParams.node_id
 * @param {string} createMessageParams.reference_id
 * @param {string} createMessageParams.callback_url
 * @param {string} createMessageParams.message
 * @param {string} createMessageParams.purpose
 * @param {string} createMessageParams.initial_salt
 * @param {boolean} createMessageParams.hash_message
 * @param {Object} options
 * @param {boolean} [options.synchronous]
 * @param {boolean} [options.sendCallbackToClient]
 * @param {string} [options.callbackFnName]
 * @param {Array} [options.callbackAdditionalArgs]
 * @param {boolean} [options.saveForRetryOnChainDisabled]
 * @param {Object} additionalParams
 * @param {string} [additionalParams.message_id]
 *
 * @returns {Promise<Object>} message ID and message salt
 */
export async function createMessage(
  createMessageParams,
  options = {},
  additionalParams = {}
) {
  let { node_id, initial_salt } = createMessageParams;
  const { reference_id, callback_url, message, purpose, hash_message } =
    createMessageParams;
  const { synchronous = false } = options;
  let {
    message_id, // Pre-generated message ID. Used by create identity function.
  } = additionalParams;

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
    const messageId = await cacheDb.getMessageIdByReferenceId(
      node_id,
      reference_id
    );
    if (messageId) {
      throw new CustomError({
        errorType: errorType.DUPLICATE_REFERENCE_ID,
      });
    }

    if (message_id == null) {
      message_id = utils.createMessageId();
    }

    if (purpose.length > config.purposeStrLength) {
      throw new CustomError({
        errorType: errorType.PURPOSE_TOO_LONG,
      });
    }

    if (hash_message) {
      if (!initial_salt) {
        initial_salt = utils.randomBase64Bytes(config.saltLength);
      } else {
        if (initial_salt.length < config.saltStrLength) {
          throw new CustomError({
            errorType: errorType.INITIAL_SALT_TOO_SHORT,
          });
        }
      }
      const message_salt = utils.generateMessageSalt(initial_salt);

      const messageData = {
        message_id,
        message,
        rp_id: node_id,
        message_salt,
        initial_salt,
        reference_id,
        callback_url,
      };

      // save message data to DB to send to AS via mq when authen complete
      await Promise.all([
        cacheDb.setMessageData(node_id, message_id, messageData),
        cacheDb.setMessageIdByReferenceId(node_id, reference_id, message_id),
      ]);

      if (synchronous) {
        await createMessageInternalAsync(createMessageParams, options, {
          node_id,
          message_id,
          message_salt,
          messageData,
          purpose,
        });
      } else {
        createMessageInternalAsync(createMessageParams, options, {
          node_id,
          message_id,
          message_salt,
          messageData,
          purpose,
        });
      }
    } else {
      if (message.length > config.messageStrLength) {
        throw new CustomError({
          errorType: errorType.MESSAGE_TOO_LONG,
        });
      }

      const messageData = {
        message_id,
        message,
        rp_id: node_id,
        reference_id,
      };

      // save message data to DB to send to AS via mq when authen complete
      await Promise.all([
        cacheDb.setMessageData(node_id, message_id, messageData),
        cacheDb.setMessageIdByReferenceId(node_id, reference_id, message_id),
      ]);

      if (synchronous) {
        await createMessageInternalAsync(createMessageParams, options, {
          node_id,
          message_id,
          messageData,
          purpose,
        });
      } else {
        createMessageInternalAsync(createMessageParams, options, {
          node_id,
          message_id,
          messageData,
          purpose,
        });
      }
    }

    if (hash_message) {
      return { message_id, initial_salt };
    } else {
      return { message_id };
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create message',
      cause: error,
    });
    logger.error({ err });

    if (
      !(
        error.name === 'CustomError' &&
        error.code === errorType.DUPLICATE_REFERENCE_ID.code
      )
    ) {
      await createMessageCleanUpOnError({
        nodeId: node_id,
        messageId: message_id,
        referenceId: reference_id,
      });
    }

    throw err;
  }
}

async function createMessageInternalAsync(
  createMessageParams,
  options = {},
  additionalParams
) {
  const { reference_id, callback_url, message, purpose, hash_message } =
    createMessageParams;
  const {
    synchronous = false,
    sendCallbackToClient = true,
    callbackFnName,
    callbackAdditionalArgs,
    saveForRetryOnChainDisabled,
  } = options;
  const { node_id, message_id, message_salt, messageData } = additionalParams;
  try {
    let messageDataToBlockchain;
    if (hash_message) {
      messageDataToBlockchain = {
        message_id,
        message: utils.hash(
          cryptoUtils.hashAlgorithm.SHA256,
          message + message_salt
        ),
        purpose,
      };
    } else {
      messageDataToBlockchain = {
        message_id,
        message,
        purpose,
      };
    }

    if (!synchronous) {
      await tendermintNdid.createMessage(
        messageDataToBlockchain,
        node_id,
        'common.createMessageInternalAsyncAfterBlockchain',
        [
          {
            node_id,
            reference_id,
            callback_url,
            message_id,
            messageData,
          },
          {
            synchronous,
            sendCallbackToClient,
            callbackFnName,
            callbackAdditionalArgs,
          },
        ],
        saveForRetryOnChainDisabled
      );
    } else {
      const { height } = await tendermintNdid.createMessage(
        messageDataToBlockchain,
        node_id
      );
      await createMessageInternalAsyncAfterBlockchain(
        { height },
        {
          node_id,
          reference_id,
          callback_url,
          message_id,
          messageData,
        },
        {
          synchronous,
          sendCallbackToClient,
          callbackFnName,
          callbackAdditionalArgs,
        }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Create message internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient({
          callbackUrl: callback_url,
          body: {
            node_id,
            type: 'create_message_result',
            success: false,
            reference_id,
            message_id,
            error: getErrorObjectForClient(error),
          },
          retry: true,
        });
      }
      if (callbackFnName != null) {
        if (callbackAdditionalArgs != null) {
          getFunction(callbackFnName)({ error }, ...callbackAdditionalArgs);
        } else {
          getFunction(callbackFnName)({ error });
        }
      }
    }

    await createMessageCleanUpOnError({
      nodeId: node_id,
      messageId: message_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function createMessageInternalAsyncAfterBlockchain(
  { height, error, chainDisabledRetryLater },
  { node_id, reference_id, callback_url, message_id, messageData },
  {
    synchronous = false,
    sendCallbackToClient = true,
    callbackFnName,
    callbackAdditionalArgs,
  } = {}
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    const creation_time = Date.now();

    await cacheDb.setMessageCreationMetadata(node_id, message_id, {
      creation_time,
    });

    const {
      reference_id: _3, // eslint-disable-line no-unused-vars
      callback_url: _4, // eslint-disable-line no-unused-vars
    } = messageData;

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient({
          callbackUrl: callback_url,
          body: {
            node_id,
            type: 'create_message_result',
            success: true,
            reference_id,
            message_id,
            creation_block_height: `${tendermint.chainId}:${height}`,
          },
          retry: true,
        });
      }
      if (callbackFnName != null) {
        if (callbackAdditionalArgs != null) {
          getFunction(callbackFnName)(
            { chainId: tendermint.chainId, height },
            ...callbackAdditionalArgs
          );
        } else {
          getFunction(callbackFnName)({ chainId: tendermint.chainId, height });
        }
      }
    }
  } catch (error) {
    logger.error({
      message: 'Create message internal async after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      err: error,
    });

    if (!synchronous) {
      if (sendCallbackToClient) {
        await callbackToClient({
          callbackUrl: callback_url,
          body: {
            node_id,
            type: 'create_message_result',
            success: false,
            reference_id,
            message_id,
            error: getErrorObjectForClient(error),
          },
          retry: true,
        });
      }
      if (callbackFnName != null) {
        if (callbackAdditionalArgs != null) {
          getFunction(callbackFnName)({ error }, ...callbackAdditionalArgs);
        } else {
          getFunction(callbackFnName)({ error });
        }
      }

      await createMessageCleanUpOnError({
        nodeId: node_id,
        messageId: message_id,
        referenceId: reference_id,
      });
    } else {
      throw error;
    }
  }
}

async function createMessageCleanUpOnError({ nodeId, messageId, referenceId }) {
  await Promise.all([
    cacheDb.removeMessageData(nodeId, messageId),
    cacheDb.removeMessageIdByReferenceId(nodeId, referenceId),
    cacheDb.removeMessageCreationMetadata(nodeId, messageId),
  ]);
}
