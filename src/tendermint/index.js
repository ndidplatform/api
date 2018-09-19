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

import { ExponentialBackoff } from 'simple-backoff';

import CustomError from '../error/custom_error';
import errorType from '../error/type';
import logger from '../logger';

import * as tendermintHttpClient from './http_client';
import TendermintWsClient from './ws_client';
import { convertAbciAppCodeToErrorType } from './abci_app_code';
import * as cacheDb from '../db/cache';
import * as utils from '../utils';
import { sha256 } from '../utils/crypto';
import * as config from '../config';

export const tendermintWsClient = new TendermintWsClient(false);

let handleTendermintNewBlock;

const expectedTx = {};
let getTxResultCallbackFn;
const txEventEmitter = new EventEmitter();
export let expectedTxsLoaded = false;
let reconnecting = false; // Use when reconnect WS

const cacheBlocks = {};
let lastKnownAppHash;

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

export function initialize() {
  return new Promise((resolve, reject) => {
    tendermintWsClient.once('connected', () => resolve());
    tendermintWsClient.connect();
  });
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

export function setTendermintNewBlockEventHandler(handler) {
  handleTendermintNewBlock = handler;
}

export async function loadExpectedTxFromDB() {
  logger.info({
    message: 'Loading backlog expected Txs for processing',
  });
  try {
    const savedExpectedTxs = await cacheDb.getAllExpectedTxs();
    if (savedExpectedTxs.length === 0) {
      logger.info({
        message: 'No backlog expected Txs to process',
      });
    }
    savedExpectedTxs.forEach(({ tx: txHash, metadata }) => {
      expectedTx[txHash] = metadata;
    });
    expectedTxsLoaded = true;
    checkForMissingExpectedTx();
  } catch (error) {
    logger.error({
      message: 'Cannot load backlog expected Txs from cache DB',
    });
  }
}

async function checkForMissingExpectedTx() {
  const txHashes = Object.keys(expectedTx).map((txHash) => {
    return {
      txHash,
      txHashSum: txHash.substring(0, 40), // Get first 20 bytes of Tx hash
    };
  });
  await Promise.all(
    txHashes.map(async ({ txHash, txHashSum }) => {
      try {
        const result = await tendermintHttpClient.tx(txHashSum);
        await processExpectedTx(txHash, result);
      } catch (error) {
        logger.warn({
          message:
            'Error getting Tx for processing missing expected Tx (Tx may still be in mempool or does not exist)',
          txHash,
          error: error.name === 'CustomError' ? error.getInfoForLog() : error,
        });
      }
    })
  );
}

async function processExpectedTx(txHash, result, fromEvent) {
  // Check for undefined again to prevent duplicate processing
  if (expectedTx[txHash] == null) return;
  logger.debug({
    message: 'Expected Tx is included in the block. Processing.',
    txHash,
  });
  try {
    const {
      waitForCommit,
      callbackFnName,
      callbackAdditionalArgs,
    } = expectedTx[txHash];
    delete expectedTx[txHash];
    const retVal = getTransactResultFromTx(result, fromEvent);
    if (waitForCommit) {
      txEventEmitter.emit(txHash, retVal);
    }
    if (callbackFnName != null) {
      if (getTxResultCallbackFn != null) {
        if (callbackAdditionalArgs != null) {
          await getTxResultCallbackFn(callbackFnName)(
            retVal,
            ...callbackAdditionalArgs
          );
        } else {
          await getTxResultCallbackFn(callbackFnName)(retVal);
        }
      } else {
        logger.error({
          message:
            'getTxResultCallbackFn has not been set but there is a callback function to call',
          callbackFnName,
        });
      }
    }
    await cacheDb.removeExpectedTxMetadata(txHash);
  } catch (error) {
    const err = new CustomError({
      message: 'Error processing expected Tx',
      details: {
        txHash,
      },
      cause: error,
    });
    logger.error(err.getInfoForLog());
  }
}

export function setTxResultCallbackFnGetter(fn) {
  if (typeof fn !== 'function') {
    throw new Error('Invalid argument type. Must be function.');
  }
  getTxResultCallbackFn = fn;
}

/**
 * Poll tendermint status until syncing === false
 */
async function pollStatusUntilSynced() {
  logger.info({
    message: 'Waiting for Tendermint to finish syncing blockchain',
  });
  if (syncing == null || syncing === true) {
    const backoff = new ExponentialBackoff({
      min: 1000,
      max: config.maxIntervalTendermintSyncCheck,
      factor: 2,
      jitter: 0,
    });

    for (;;) {
      const status = await tendermintHttpClient.status();
      syncing = status.sync_info.catching_up;
      if (syncing === false) {
        logger.info({
          message: 'Tendermint blockchain synced',
        });
        eventEmitter.emit('ready');
        processMissingBlocksAfterSync(status);
        break;
      }
      await utils.wait(backoff.next());
    }
  }
}

tendermintWsClient.on('connected', async () => {
  connected = true;
  pollStatusUntilSynced();
  tendermintWsClient.subscribeToNewBlockEvent();
  tendermintWsClient.subscribeToTxEvent();
  if (reconnecting) {
    // Check for expected transactions in case there are missing Tx events after reconnect
    checkForMissingExpectedTx();
    eventEmitter.emit('reconnect');
    reconnecting = false;
  }
});

tendermintWsClient.on('disconnected', () => {
  connected = false;
  syncing = null;
  reconnecting = true;
});

tendermintWsClient.on('newBlock#event', async function handleNewBlockEvent(
  error,
  result
) {
  if (syncing !== false) {
    return;
  }
  const blockHeight = getBlockHeightFromNewBlockEvent(result);
  cacheBlocks[blockHeight] = result.data.value.block;

  logger.debug({
    message: 'Tendermint NewBlock event received',
    blockHeight,
  });

  const appHash = getAppHashFromNewBlockEvent(result);

  await processNewBlock(blockHeight, appHash);
});

tendermintWsClient.on('tx#event', async function handleTxEvent(error, result) {
  const txBase64 = result.data.value.TxResult.tx;
  const txString = Buffer.from(txBase64, 'base64').toString('utf8');
  const txHash = sha256(txString).toString('hex');
  if (expectedTx[txHash] == null) return;
  await processExpectedTx(txHash, result, true);
});

async function processMissingBlocksAfterSync(status) {
  const blockHeight = status.sync_info.latest_block_height;
  const appHash = status.sync_info.latest_app_hash;
  await processNewBlock(blockHeight, appHash);
}

async function processNewBlock(blockHeight, appHash) {
  if (latestBlockHeight == null || latestBlockHeight < blockHeight) {
    const lastKnownBlockHeight = latestBlockHeight;
    latestBlockHeight = blockHeight;

    const missingBlockCount =
      lastKnownBlockHeight == null
        ? null
        : blockHeight - lastKnownBlockHeight - 1;
    if (missingBlockCount > 0) {
      logger.debug({
        message: 'Tendermint NewBlock missed',
        missingBlockCount,
      });
    }

    if (lastKnownAppHash !== appHash) {
      if (handleTendermintNewBlock) {
        await handleTendermintNewBlock(null, blockHeight, missingBlockCount);
      }
    }
    lastKnownAppHash = appHash;
    delete cacheBlocks[blockHeight - 1];
    saveLatestBlockHeight(blockHeight);
  }
}

/**
 *
 * @param {number} fromHeight
 * @param {number} toHeight
 * @returns {Promise<Object[]>}
 */
export async function getBlocks(fromHeight, toHeight) {
  logger.debug({
    message: 'Get blocks from Tendermint',
    fromHeight,
    toHeight,
  });
  const heights = Array.from(
    { length: toHeight - fromHeight + 1 },
    (v, i) => i + fromHeight
  );
  const blocks = await Promise.all(
    heights.map(async (height) => {
      if (cacheBlocks[height]) {
        return cacheBlocks[height];
      } else {
        const result = await tendermintHttpClient.block(height);
        return result.block;
      }
    })
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
  logger.debug({
    message: 'Get block results from Tendermint',
    fromHeight,
    toHeight,
  });
  const heights = Array.from(
    { length: toHeight - fromHeight + 1 },
    (v, i) => i + fromHeight
  );
  const results = await Promise.all(
    heights.map((height) => tendermintHttpClient.blockResults(height))
  );
  return results;
}

function getQueryResult(result) {
  logger.debug({
    message: 'Tendermint query result',
    result,
  });

  if (result.response.log.indexOf('not found') !== -1) {
    return null;
  }

  if (result.response.value == null) {
    throw new CustomError({
      errorType: errorType.TENDERMINT_QUERY_ERROR,
      details: result,
    });
  }

  const queryResult = Buffer.from(result.response.value, 'base64').toString();
  try {
    return JSON.parse(queryResult);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.TENDERMINT_QUERY_RESULT_JSON_PARSE_ERROR,
      cause: error,
    });
  }
}

function getTransactResultFromTx(result, fromEvent) {
  logger.debug({
    message: 'Tendermint transact result from Tx',
    fromEvent,
    result,
  });

  const height = parseInt(
    fromEvent ? result.data.value.TxResult.height : result.height
  );

  const deliverTxResult = fromEvent
    ? result.data.value.TxResult.result
    : result.tx_result;

  if (deliverTxResult.log !== 'success') {
    if (deliverTxResult.code != null) {
      const convertedErrorType = convertAbciAppCodeToErrorType(
        deliverTxResult.code
      );
      if (convertedErrorType != null) {
        return {
          error: new CustomError({
            errorType: convertedErrorType,
            details: {
              abciCode: deliverTxResult.code,
              height,
            },
          }),
        };
      }
    }
    return {
      error: new CustomError({
        errorType: errorType.TENDERMINT_TRANSACT_ERROR,
        details: {
          abciCode: deliverTxResult.code,
          height,
        },
      }),
    };
  }
  return {
    height,
  };
}

function getBroadcastTxSyncResult(result) {
  logger.debug({
    message: 'Tendermint broadcast Tx sync result',
    result,
  });

  if (result.code !== 0) {
    const convertedErrorType = convertAbciAppCodeToErrorType(result.code);
    if (convertedErrorType != null) {
      throw new CustomError({
        errorType: convertedErrorType,
        details: {
          abciCode: result.code,
        },
      });
    } else {
      throw new CustomError({
        errorType: errorType.TENDERMINT_TRANSACT_ERROR,
        details: {
          abciCode: result.code,
        },
      });
    }
  }

  const hash = result.hash;

  return { hash };
}

function getBroadcastTxCommitResult(result) {
  logger.debug({
    message: 'Tendermint broadcast Tx commit result',
    result,
  });

  const height = parseInt(result.height);

  if (result.deliver_tx.log !== 'success') {
    if (result.deliver_tx.code != null) {
      const convertedErrorType = convertAbciAppCodeToErrorType(
        result.deliver_tx.code
      );
      if (convertedErrorType != null) {
        throw new CustomError({
          errorType: convertedErrorType,
          details: {
            abciCode: result.deliver_tx.code,
            height,
          },
        });
      }
    }
    throw new CustomError({
      errorType: errorType.TENDERMINT_TRANSACT_ERROR,
      details: {
        abciCode: result.code,
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

  const dataStr = JSON.stringify(data);
  const queryData =
    fnName +
    '|' +
    (dataStr != null ? Buffer.from(dataStr).toString('base64') : '');

  try {
    const result = await tendermintHttpClient.abciQuery(queryData, height);
    return getQueryResult(result);
  } catch (error) {
    if (error.type === 'JSON-RPC ERROR') {
      throw new CustomError({
        errorType: errorType.TENDERMINT_QUERY_JSON_RPC_ERROR,
        details: error.error,
      });
    } else {
      throw error;
    }
  }
}

export async function transact({
  nodeId,
  fnName,
  params,
  nonce = utils.getNonce(),
  callbackFnName,
  callbackAdditionalArgs,
  useMasterKey = false,
}) {
  if (nodeId == null || nodeId == '') {
    throw new CustomError({
      message: 'Missing argument "nodeId"',
    });
  }
  const waitForCommit = !callbackFnName;
  logger.debug({
    message: 'Tendermint transact',
    nodeId,
    fnName,
    params,
    nonce,
    waitForCommit,
    useMasterKey,
    callbackFnName,
    callbackAdditionalArgs,
  });

  if (callbackAdditionalArgs != null) {
    if (!Array.isArray(callbackAdditionalArgs)) {
      throw new CustomError({
        message: 'callbackAdditionalArgs must be an array',
      });
    }
  }

  const paramsStr = JSON.stringify(params);
  const tx =
    fnName +
    '|' +
    (paramsStr != null ? Buffer.from(paramsStr).toString('base64') : '') +
    '|' +
    nonce +
    '|' +
    // FIXME: signature need to be able to specify node ID
    (await utils.createSignature(
      paramsStr + nonce,
      nodeId,
      useMasterKey
    )).toString('base64') +
    '|' +
    Buffer.from(nodeId).toString('base64');

  const txHash = sha256(tx).toString('hex');
  const callbackData = {
    waitForCommit,
    callbackFnName,
    callbackAdditionalArgs,
  };
  expectedTx[txHash] = callbackData;
  await cacheDb.setExpectedTxMetadata(txHash, callbackData);

  try {
    let promise;
    if (waitForCommit) {
      promise = new Promise((resolve, reject) =>
        txEventEmitter.once(txHash, ({ error, ...rest }) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(rest);
        })
      );
    }
    const responseResult = await tendermintHttpClient.broadcastTxSync(tx);
    const broadcastTxSyncResult = getBroadcastTxSyncResult(responseResult);
    if (waitForCommit) {
      const result = await promise;
      return result;
    }
    return broadcastTxSyncResult;
  } catch (error) {
    delete expectedTx[txHash];
    await cacheDb.removeExpectedTxMetadata(txHash);
    if (error.type === 'JSON-RPC ERROR') {
      throw new CustomError({
        errorType: errorType.TENDERMINT_TRANSACT_JSON_RPC_ERROR,
        details: error.error,
      });
    } else {
      throw error;
    }
  }
}

export function getTransactionListFromBlock(block) {
  const txs = block.data.txs; // array of transactions in the block base64 encoded
  // const height = parseInt(block.header.height);

  if (txs == null) {
    return [];
  }

  const transactions = txs.map((tx) => {
    const txContent = Buffer.from(tx, 'base64')
      .toString()
      .split('|');
    return {
      fnName: txContent[0],
      args: JSON.parse(Buffer.from(txContent[1], 'base64').toString()),
    };
  });

  return transactions;
}

export function getBlockHeightFromNewBlockHeaderEvent(result) {
  return parseInt(result.data.value.header.height);
}

export function getBlockHeightFromNewBlockEvent(result) {
  return parseInt(result.data.value.block.header.height);
}

export function getAppHashFromNewBlockEvent(result) {
  return result.data.value.block.header.app_hash;
}
