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

import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

import CustomError from '../error/customError';
import errorType from '../error/type';
import logger from '../logger';

import * as tendermintHttpClient from './httpClient';
import TendermintWsClient from './wsClient';
import { convertAbciAppCodeToErrorType } from './abciAppCode';
import * as utils from '../utils';
import * as config from '../config';

let handleTendermintNewBlockHeaderEvent;

export let syncing = null;
export let connected = false;

export const eventEmitter = new EventEmitter();

const latestBlockHeightFilepath = path.join(
  config.dataDirectoryPath,
  `latest-block-height-${config.nodeId}`
);

export let latestBlockHeight = null;
let latestProcessedBlockHeight = null;
try {
  const blockHeight = fs.readFileSync(latestBlockHeightFilepath, 'utf8');
  latestBlockHeight = blockHeight;
  latestProcessedBlockHeight = blockHeight;
} catch (error) {
  if (error.code === 'ENOENT') {
    logger.warn({
      message: 'Latest block height file not found',
    });
  } else {
    logger.error({
      message: 'Cannot read latest block height file',
      error,
    });
  }
}

/**
 * Save last seen block height to file for loading it on server restart
 * @param {number} height Block height to save
 */
function saveLatestBlockHeight(height) {
  if (latestProcessedBlockHeight < height) {
    fs.writeFile(latestBlockHeightFilepath, height, (err) => {
      if (err) {
        logger.error({
          message: 'Cannot write latest block height file',
          error: err,
        });
      }
    });
    latestProcessedBlockHeight = height;
  }
}

export function setTendermintNewBlockHeaderEventHandler(handler) {
  handleTendermintNewBlockHeaderEvent = handler;
}

/**
 * Poll tendermint status until syncing === false
 */
async function pollStatusUntilSynced() {
  logger.info({
    message: 'Waiting for Tendermint to finish syncing blockchain',
  });
  if (syncing == null || syncing === true) {
    for (;;) {
      const status = await tendermintWsClient.getStatus();
      syncing = status.sync_info.syncing;
      if (syncing === false) {
        logger.info({
          message: 'Tendermint blockchain synced',
        });
        eventEmitter.emit('ready');
        break;
      }
      await utils.wait(1000);
    }
  }
}

export const tendermintWsClient = new TendermintWsClient();

tendermintWsClient.on('connected', () => {
  connected = true;
  pollStatusUntilSynced();
});

tendermintWsClient.on('disconnected', () => {
  connected = false;
  syncing = null;
});

tendermintWsClient.on('newBlockHeader#event', async (error, result) => {
  if (syncing !== false) {
    return;
  }
  const blockHeight = result.data.value.header.height;

  logger.debug({
    message: 'Tendermint NewBlockHeader event received',
    blockHeight,
  });

  if (latestBlockHeight == null || latestBlockHeight < blockHeight) {
    const lastKnownBlockHeight = latestBlockHeight;
    latestBlockHeight = blockHeight;

    const missingBlockCount =
      lastKnownBlockHeight == null
        ? null
        : blockHeight - lastKnownBlockHeight - 1;
    if (handleTendermintNewBlockHeaderEvent) {
      await handleTendermintNewBlockHeaderEvent(
        error,
        result,
        missingBlockCount
      );
    }
    saveLatestBlockHeight(blockHeight);
  }
});

/**
 *
 * @param {number} fromHeight
 * @param {number} toHeight
 * @returns {Promise<Object[]>}
 */
export async function getBlocks(fromHeight, toHeight) {
  const heights = Array.from(
    { length: toHeight - fromHeight + 1 },
    (v, i) => i + fromHeight
  );
  const blocks = await Promise.all(
    heights.map((height) => tendermintWsClient.getBlock(height))
  );
  return blocks;
}

/**
 *
 * @param {number} fromHeight
 * @param {number} toHeight
 * @returns {Promise<Object[]>}
 */
export async function getBlockResults(fromHeight, toHeight) {
  const heights = Array.from(
    { length: toHeight - fromHeight + 1 },
    (v, i) => i + fromHeight
  );
  const results = await Promise.all(
    heights.map((height) => tendermintWsClient.getBlockResults(height))
  );
  return results;
}

function getQueryResult(result) {
  logger.debug({
    message: 'Tendermint query result',
    result,
  });

  // const currentHeight = parseInt(response.result.response.height);

  // if (result.check_tx.log !== 'success') {
  //   if (result.check_tx.code != null) {
  //     const convertedErrorType = convertAbciAppCodeToErrorType(
  //       result.check_tx.code
  //     );
  //     if (convertedErrorType != null) {
  //       throw new CustomError({
  //         message: convertedErrorType.message,
  //         code: convertedErrorType.code,
  //         clientError: convertedErrorType.clientError,
  //         details: {
  //           abciCode: result.check_tx.code,
  //         },
  //       });
  //     }
  //   }
  //   throw new CustomError({
  //     message: errorType.TENDERMINT_TRANSACT_ERROR.message,
  //     code: errorType.TENDERMINT_TRANSACT_ERROR.code,
  //     details: {
  //       abciCode: result.check_tx.code,
  //     },
  //   });
  // }

  if (result.response.log.indexOf('not found') !== -1) {
    return null;
  }

  if (result.response.value == null) {
    throw new CustomError({
      message: errorType.TENDERMINT_QUERY_ERROR.message,
      code: errorType.TENDERMINT_QUERY_ERROR.code,
      details: result,
    });
  }

  const queryResult = Buffer.from(result.response.value, 'base64').toString();
  try {
    return JSON.parse(queryResult);
  } catch (error) {
    throw new CustomError({
      message: errorType.TENDERMINT_QUERY_RESULT_JSON_PARSE_ERROR.message,
      code: errorType.TENDERMINT_QUERY_RESULT_JSON_PARSE_ERROR.code,
      cause: error,
    });
  }
}

function getTransactResult(result) {
  logger.debug({
    message: 'Tendermint transact result',
    result,
  });

  const height = result.height;

  // if (result.check_tx.code !== 0) {
  //   throw '';
  // }

  if (result.deliver_tx.log !== 'success') {
    if (result.deliver_tx.code != null) {
      const convertedErrorType = convertAbciAppCodeToErrorType(
        result.deliver_tx.code
      );
      if (convertedErrorType != null) {
        throw new CustomError({
          message: convertedErrorType.message,
          code: convertedErrorType.code,
          clientError: convertedErrorType.clientError,
          details: {
            abciCode: result.deliver_tx.code,
            height,
          },
        });
      }
    }
    throw new CustomError({
      message: errorType.TENDERMINT_TRANSACT_ERROR.message,
      code: errorType.TENDERMINT_TRANSACT_ERROR.code,
      details: {
        abciCode: result.deliver_tx.code,
        height,
      },
    });
  }
  return {
    height,
  };
}

export async function query(fnName, data, height) {
  logger.debug({
    message: 'Tendermint query',
    fnName,
    data,
  });

  const queryData = fnName + '|' + JSON.stringify(data);

  const dataBase64Encoded = Buffer.from(queryData).toString('base64');

  try {
    const result = await tendermintHttpClient.abciQuery(
      dataBase64Encoded,
      height
    );
    return getQueryResult(result);
  } catch (error) {
    if (error.type === 'JSON-RPC ERROR') {
      throw new CustomError({
        message: errorType.TENDERMINT_QUERY_JSON_RPC_ERROR.message,
        code: errorType.TENDERMINT_QUERY_JSON_RPC_ERROR.code,
        details: error.error,
      });
    } else {
      throw error;
    }
  }
}

export async function transact(fnName, data, nonce, useMasterKey) {
  logger.debug({
    message: 'Tendermint transact',
    fnName,
    data,
    nonce,
  });

  const tx =
    fnName +
    '|' +
    JSON.stringify(data) +
    '|' +
    nonce +
    '|' +
    (await utils.createSignature(data, nonce, useMasterKey)) +
    '|' +
    config.nodeId;

  const txBase64Encoded = Buffer.from(tx).toString('base64');

  try {
    const result = await tendermintHttpClient.broadcastTxCommit(
      txBase64Encoded
    );
    return getTransactResult(result);
  } catch (error) {
    if (error.type === 'JSON-RPC ERROR') {
      throw new CustomError({
        message: errorType.TENDERMINT_TRANSACT_JSON_RPC_ERROR.message,
        code: errorType.TENDERMINT_TRANSACT_JSON_RPC_ERROR.code,
        details: error.error,
      });
    } else {
      throw error;
    }
  }
}

export function getTransactionListFromBlockQuery(result) {
  const txs = result.block.data.txs; // array of transactions in the block base64 encoded
  //const height = result.data.data.block.header.height;

  if (txs == null) {
    return [];
  }

  const transactions = txs.map((tx) => {
    // Decode base64 2 times because we send transactions to tendermint in base64 format
    const txContentBase64 = Buffer.from(tx, 'base64').toString();
    const txContent = Buffer.from(txContentBase64, 'base64')
      .toString()
      .split('|');
    return {
      fnName: txContent[0],
      args: JSON.parse(txContent[1]),
    };
  });

  return transactions;
}

export function getBlockHeightFromNewBlockHeaderEvent(result) {
  return result.data.value.header.height;
}
