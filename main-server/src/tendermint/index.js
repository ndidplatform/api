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

import protobuf from 'protobufjs';
import { ExponentialBackoff } from 'simple-backoff';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../logger';

import * as tendermintHttpClient from './http_client';
import TendermintWsClient from './ws_client';
import * as tendermintNdid from './ndid';
import { convertAbciAppCodeToErrorType } from './abci_app_code';
import * as cacheDb from '../db/cache';
import * as utils from '../utils';
import { sha256, randomBase64Bytes } from '../utils/crypto';

import * as config from '../config';

const tendermintProtobufRootInstance = new protobuf.Root();
const tendermintProtobufRoot = tendermintProtobufRootInstance.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'tendermint.proto'),
  { keepCase: true }
);
const TendermintTx = tendermintProtobufRoot.lookupType('Tx');
const TendermintQuery = tendermintProtobufRoot.lookupType('Query');

const successBase64 = Buffer.from('success').toString('base64');
const trueBase64 = Buffer.from('true').toString('base64');

export const tendermintWsClient = new TendermintWsClient(false);

let handleTendermintNewBlock;

const expectedTx = {};
let getTxResultCallbackFn;
const txEventEmitter = new EventEmitter();
export let expectedTxsLoaded = false;
let reconnecting = false; // Use when reconnect WS
let pollingStatus = false;

let cacheBlocks = {};
let lastKnownAppHash;

export let syncing = null;
export let connected = false;

export let blockchainInitialized = false;
let waitForInitEndedBeforeReady = true;

export const eventEmitter = new EventEmitter();

const chainIdFilepath = path.join(
  config.dataDirectoryPath,
  `chain-id-${config.nodeId}`
);
const latestBlockHeightFilepath = path.join(
  config.dataDirectoryPath,
  `latest-block-height-${config.nodeId}`
);

export let chainId = null;

export let latestBlockHeight = null;
let latestProcessedBlockHeight = null;

export function loadSavedData() {
  try {
    chainId = fs.readFileSync(chainIdFilepath, 'utf8');
    logger.info({
      message: 'Chain ID read from file',
      chainId,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn({
        message: 'Chain ID file not found',
      });
    } else {
      logger.error({
        message: 'Cannot read chain ID file',
        error,
      });
    }
  }

  try {
    const blockHeight = fs.readFileSync(latestBlockHeightFilepath, 'utf8');
    latestBlockHeight = parseInt(blockHeight);
    latestProcessedBlockHeight = parseInt(blockHeight);
    logger.info({
      message: 'Latest block height read from file',
      blockHeight,
    });
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

  if (
    (chainId == null && latestBlockHeight != null) ||
    (chainId != null && latestBlockHeight == null)
  ) {
    const error = new CustomError({
      message: 'Missing data file',
      details: {
        chainIdFileExist: chainId != null,
        latestBlockHeightFileExist: latestBlockHeight != null,
      },
    });
    logger.error(error.getInfoForLog());
    throw error;
  }
}

export async function initialize() {
  tendermintWsClient.subscribeToNewBlockEvent();
  tendermintWsClient.subscribeToTxEvent();
}

export function connectWS() {
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

function saveChainId(chainIdToSave) {
  fs.writeFile(chainIdFilepath, chainIdToSave, (err) => {
    if (err) {
      logger.error({
        message: 'Cannot write chain ID file',
        error: err,
      });
    }
  });
  chainId = chainIdToSave;
}

export function setTendermintNewBlockEventHandler(handler) {
  handleTendermintNewBlock = handler;
}

export async function loadExpectedTxFromDB() {
  logger.info({
    message: 'Loading backlog expected Txs for processing',
  });
  try {
    const savedExpectedTxs = await cacheDb.getAllExpectedTxs(config.nodeId);
    if (savedExpectedTxs.length === 0) {
      logger.info({
        message: 'No backlog expected Txs to process',
      });
    }
    savedExpectedTxs.forEach(({ tx: txHash, metadata }) => {
      expectedTx[txHash] = metadata;
    });
    expectedTxsLoaded = true;
    processMissingExpectedTxs();
  } catch (error) {
    logger.error({
      message: 'Cannot load backlog expected Txs from cache DB',
    });
  }
}

async function processMissingExpectedTxs() {
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
      transactParams,
      callbackFnName,
      callbackAdditionalArgs,
    } = expectedTx[txHash];
    delete expectedTx[txHash];
    let retVal = getTransactResultFromTx(result, fromEvent);
    const waitForCommit = !callbackFnName;
    if (waitForCommit) {
      txEventEmitter.emit(txHash, retVal);
    } else {
      if (retVal.error) {
        if (
          retVal.error.code === errorType.ABCI_CHAIN_DISABLED.code &&
          transactParams.saveForRetryOnChainDisabled
        ) {
          await handleBlockchainDisabled(transactParams);
          retVal = { chainDisabledRetryLater: true };
        }
      }
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
    await cacheDb.removeExpectedTxMetadata(config.nodeId, txHash);
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
  if (syncing == null && !pollingStatus) {
    pollingStatus = true;
    const backoff = new ExponentialBackoff({
      min: 1000,
      max: config.maxIntervalTendermintSyncCheck,
      factor: 2,
      jitter: 0,
    });

    for (;;) {
      const status = await tendermintHttpClient.status();
      if(status.sync_info) {
        syncing = status.sync_info.catching_up;
      } else {
        //syncing not changed
        logger.error({
          message: 'Tendermint /status return unexpected result',
          result: status
        });
      }
      if (syncing === false) {
        logger.info({
          message: 'Tendermint blockchain synced',
        });

        const currentChainId = status.node_info.network;
        if (chainId == null) {
          // Save chain ID to file on fresh start
          saveChainId(currentChainId);
          const blockHeight = parseInt(status.sync_info.latest_block_height);
          saveLatestBlockHeight(blockHeight);
        }
        if (currentChainId !== chainId) {
          logger.info({
            message: 'New chain ID detected',
            newChainId: currentChainId,
            oldChainId: chainId,
          });
          await handleNewChain(currentChainId);
        }
        pollingStatus = false;
        return status;
      }
      await utils.wait(backoff.next());
    }
  }
}

export async function pollInitStatusUntilInitEnded() {
  logger.info({
    message: 'Waiting for blockchain initialization',
  });

  const backoff = new ExponentialBackoff({
    min: 1000,
    max: config.maxIntervalTendermintSyncCheck,
    factor: 2,
    jitter: 0,
  });

  for (;;) {
    const { init_ended } = await tendermintNdid.isInitEnded();
    if (init_ended) {
      logger.info({
        message: 'Blockchain initialized',
      });

      blockchainInitialized = init_ended;
      return;
    }
    await utils.wait(backoff.next());
  }
}

export function setWaitForInitEndedBeforeReady(wait) {
  waitForInitEndedBeforeReady = wait;
}

async function handleNewChain(newChainId) {
  saveChainId(newChainId);
  lastKnownAppHash = null;
  cacheBlocks = {};
  latestBlockHeight = 1;
  latestProcessedBlockHeight = 0;
  saveLatestBlockHeight(1);
  await cacheDb.changeAllDataKeysWithExpectedBlockHeight(1);
}

async function handleBlockchainDisabled(transactParams) {
  logger.info({
    message:
      'Saving transaction for retry when new chain is up and running or current chain is enabled again',
  });
  await saveTransactRequestForRetry(transactParams);
}

export async function loadAndRetryBacklogTransactRequests() {
  const transactRequests = await cacheDb.getAllTransactRequestForRetry(
    config.nodeId
  );
  if (transactRequests.length > 0) {
    logger.debug({
      message: 'Backlog transact requests to retry',
      transactRequests,
    });
    await Promise.all(
      transactRequests.map(async ({ id, transactParams }) => {
        await transact(transactParams);
        await cacheDb.removeTransactRequestForRetry(config.nodeId, id);
      })
    );
  } else {
    logger.info({
      message: 'No backlog transact request to retry',
    });
  }
}

function checkForSetLastBlock(parsedTransactionsInBlocks) {
  for (let i = parsedTransactionsInBlocks.length - 1; i >= 0; i--) {
    const transactions = parsedTransactionsInBlocks[i].transactions;
    for (let j = transactions.length - 1; j >= 0; j--) {
      const transaction = transactions[j];
      if (transaction.fnName === 'SetLastBlock') {
        if (
          transaction.args.block_height === -1 ||
          transaction.args.block_height > latestBlockHeight
        ) {
          loadAndRetryBacklogTransactRequests();
          return;
        }
      }
    }
  }
}

tendermintWsClient.on('connected', async () => {
  connected = true;
  if (reconnecting) {
    tendermintWsClient.subscribeToNewBlockEvent();
    tendermintWsClient.subscribeToTxEvent();
    const statusOnSync = await pollStatusUntilSynced();
    if (waitForInitEndedBeforeReady) {
      await pollInitStatusUntilInitEnded();
    }
    eventEmitter.emit('ready', statusOnSync);
    processMissingBlocks(statusOnSync);
    processMissingExpectedTxs();
    loadAndRetryBacklogTransactRequests();
    reconnecting = false;
  } else {
    const statusOnSync = await pollStatusUntilSynced();
    if (waitForInitEndedBeforeReady) {
      await pollInitStatusUntilInitEnded();
    }
    eventEmitter.emit('ready', statusOnSync);
  }
});

tendermintWsClient.on('disconnected', () => {
  connected = false;
  syncing = null;
  blockchainInitialized = false;
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
  if (syncing !== false) {
    return;
  }
  const txBase64 = result.data.value.TxResult.tx;
  const txBuffer = Buffer.from(txBase64, 'base64');
  const txHash = sha256(txBuffer).toString('hex');
  if (expectedTx[txHash] == null) return;
  await processExpectedTx(txHash, result, true);
});

export async function processMissingBlocks(statusOnSync) {
  const blockHeight = statusOnSync.sync_info.latest_block_height;
  const appHash = statusOnSync.sync_info.latest_app_hash;
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

    if (lastKnownAppHash !== appHash && missingBlockCount != null) {
      if (handleTendermintNewBlock) {
        // messages that arrived before 'NewBlock' event
        // including messages between the start of missing block's height
        // and the block before latest block height
        // (not only just (current height - 1) in case 'NewBlock' events are missing)
        // NOTE: Tendermint always create an ending empty block. A block with transactions and
        // a block that signs the previous block which indicates that the previous block is valid
        const fromHeight = blockHeight - 1 - missingBlockCount;
        const toHeight = blockHeight - 1;

        const parsedTransactionsInBlocks = (await getParsedTxsInBlocks(
          fromHeight,
          toHeight
        )).filter(({ transactions }) => transactions.length >= 0);
        checkForSetLastBlock(parsedTransactionsInBlocks);
        await handleTendermintNewBlock(
          fromHeight,
          toHeight,
          parsedTransactionsInBlocks
        );
      }
    }
    lastKnownAppHash = appHash;
    delete cacheBlocks[blockHeight - 1];
    saveLatestBlockHeight(blockHeight);
  }
}

async function getParsedTxsInBlocks(fromHeight, toHeight) {
  const [blocks, blockResults] = await Promise.all([
    getBlocks(fromHeight, toHeight),
    getBlockResults(fromHeight, toHeight),
  ]);
  const parsedTransactionsInBlocks = await Promise.all(
    blocks.map(async (block, blockIndex) => {
      const height = parseInt(block.header.height);

      const transactions = getTransactionListFromBlock(block);

      const successTransactions = transactions.filter((transaction, index) => {
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

      return {
        height,
        transactions: successTransactions,
      };
    })
  );
  return parsedTransactionsInBlocks;
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
    const parsedResultValue = JSON.parse(queryResult);

    logger.debug({
      message: 'Tendermint query parsed result value',
      parsedResultValue,
    });

    return parsedResultValue;
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

/**
 *
 * @param {string} fnName
 * @param {Buffer} params
 * @param {number} height
 */
export async function query(fnName, params, height) {
  logger.debug({
    message: 'Tendermint query',
    fnName,
    params,
  });

  const paramsJsonString = JSON.stringify(params);

  const queryObject = {
    method: fnName,
    params: paramsJsonString,
  };
  const queryProto = TendermintQuery.create(queryObject);
  const queryProtoBuffer = TendermintQuery.encode(queryProto).finish();
  const queryProtoBufferHex = queryProtoBuffer.toString('hex');

  try {
    const result = await tendermintHttpClient.abciQuery(
      queryProtoBufferHex,
      height
    );
    return getQueryResult(result);
  } catch (error) {
    if (error.message === 'JSON-RPC ERROR') {
      throw new CustomError({
        errorType: errorType.TENDERMINT_QUERY_JSON_RPC_ERROR,
        details: error.error,
      });
    } else {
      throw error;
    }
  }
}

/**
 *
 * @param {Object} transactParams
 * @param {string} transactParams.nodeId
 * @param {string} transactParams.fnName
 * @param {Buffer} transactParams.params
 * @param {Buffer} transactParams.nonce
 * @param {string} transactParams.callbackFnName
 * @param {Array} transactParams.callbackAdditionalArgs
 * @param {boolean} transactParams.useMasterKey
 */
export async function transact({
  nodeId,
  fnName,
  params,
  nonce = utils.getNonce(),
  callbackFnName,
  callbackAdditionalArgs,
  useMasterKey = false,
  saveForRetryOnChainDisabled = false,
}) {
  if (nodeId == null || nodeId == '') {
    throw new CustomError({
      message: 'Missing argument "nodeId"',
    });
  }

  if (callbackAdditionalArgs != null) {
    if (!Array.isArray(callbackAdditionalArgs)) {
      throw new CustomError({
        message: 'callbackAdditionalArgs must be an array',
      });
    }
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

  const paramsJsonString = JSON.stringify(params);

  const txObject = {
    method: fnName,
    params: paramsJsonString,
    nonce,
    signature: await utils.createSignature(
      Buffer.concat([
        Buffer.from(fnName, 'utf8'),
        Buffer.from(paramsJsonString, 'utf8'),
        nonce,
      ]).toString('base64'),
      nodeId,
      useMasterKey
    ),
    node_id: nodeId,
  };
  const txProto = TendermintTx.create(txObject);
  const txProtoBuffer = TendermintTx.encode(txProto).finish();
  const txProtoBufferHex = txProtoBuffer.toString('hex');

  const txHash = sha256(txProtoBuffer).toString('hex');
  const transactParams = {
    nodeId,
    fnName,
    params,
    callbackFnName,
    callbackAdditionalArgs,
    useMasterKey,
    saveForRetryOnChainDisabled,
  };
  const callbackData = {
    transactParams,
    callbackFnName,
    callbackAdditionalArgs,
  };
  expectedTx[txHash] = callbackData;
  await cacheDb.setExpectedTxMetadata(config.nodeId, txHash, callbackData);

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
    const responseResult = await tendermintHttpClient.broadcastTxSync(
      txProtoBufferHex
    );
    const broadcastTxSyncResult = getBroadcastTxSyncResult(responseResult);
    if (waitForCommit) {
      const result = await promise;
      return result;
    }
    return broadcastTxSyncResult;
  } catch (error) {
    delete expectedTx[txHash];
    await cacheDb.removeExpectedTxMetadata(config.nodeId, txHash);
    if (error.message === 'JSON-RPC ERROR') {
      throw new CustomError({
        errorType: errorType.TENDERMINT_TRANSACT_JSON_RPC_ERROR,
        details: error.error,
      });
    } else if (
      error.code === errorType.ABCI_CHAIN_DISABLED.code &&
      saveForRetryOnChainDisabled
    ) {
      await handleBlockchainDisabled(transactParams);
      return { chainDisabledRetryLater: true };
    } else {
      throw error;
    }
  }
}

async function saveTransactRequestForRetry(transactParams) {
  try {
    const id = randomBase64Bytes(10);
    await cacheDb.addTransactRequestForRetry(config.nodeId, id, transactParams);
  } catch (error) {
    const err = new CustomError({
      errorType: errorType.CANNOT_SAVE_TRANSACT_REQUEST_FOR_RETRY,
      cause: error,
    });
    throw err;
  }
}

export function getTransactionListFromBlock(block) {
  const txs = block.data.txs; // array of transactions in the block base64 encoded
  // const height = parseInt(block.header.height);

  if (txs == null) {
    return [];
  }

  const transactions = txs.map((tx) => {
    const txProtoBuffer = Buffer.from(tx, 'base64');
    const txObject = TendermintTx.decode(txProtoBuffer);
    const args = JSON.parse(txObject.params);
    return {
      fnName: txObject.method,
      args,
      nodeId: txObject.node_id,
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
