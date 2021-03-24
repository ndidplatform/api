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

import TelemetryLogger from '../telemetry';

import { delegateToWorker } from '../master-worker-interface/server';

// import * as tendermintHttpClient from './http_client';
import TendermintWsClient from './ws_client';
import * as tendermintWsPool from './ws_pool';
import * as tendermintNdid from './ndid';
import { convertAbciAppCodeToErrorType } from './abci_app_code';
import * as cacheDb from '../db/cache';
import * as utils from '../utils';
import { sha256, randomBase64Bytes } from '../utils/crypto';

import * as node from '../node';
import MODE from '../mode';
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

export const tendermintWsClient = new TendermintWsClient('main', false);

let handleTendermintNewBlock;

let processingBlocks = {};
let processingBlocksCount = 0;

const expectedTx = {};
const expectedTxMetricsData = {};
let expectedTxsCount = 0;
let getTxResultCallbackFn;
const txEventEmitter = new EventEmitter();
// export let expectedTxsLoaded = false;
let reconnecting = false; // Use when reconnect WS
let pollingStatus = false;

let cacheBlocks = {};
let lastKnownAppHash;

export let tendermintVersion;
export let tendermintVersionStr;
export let syncing = null;
export let currentChainId;
export let abciVersion;
export let connected = false;

export let blockchainInitialized = false;
let waitForInitEndedBeforeReady = true;

export const eventEmitter = new EventEmitter();
export const metricsEventEmitter = new EventEmitter();

let telemetryEnabled = false;

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
        err: error,
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
        err: error,
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
    logger.error({ err: error });
    throw error;
  }
}

export async function initialize() {
  tendermintWsClient.subscribeToNewBlockEvent();
}

export function setTelemetryEnabled(_telemetryEnabled = false) {
  telemetryEnabled = _telemetryEnabled;
}

export async function connectWS() {
  await tendermintWsPool.initialize();
  await new Promise((resolve) => {
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
          err,
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
        err,
      });
    }
  });
  chainId = chainIdToSave;
}

function removeChainIdAndLatestBlockHeightFiles() {
  try {
    fs.unlinkSync(chainIdFilepath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.error({
        message: 'Cannot unlink chain ID file',
        err: error,
      });
    }
  }

  try {
    fs.unlinkSync(latestBlockHeightFilepath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.error({
        message: 'Cannot unlink latest block height files',
        err: error,
      });
    }
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
    const savedExpectedTxs = await cacheDb.getAllExpectedTxs(config.nodeId);
    if (savedExpectedTxs.length === 0) {
      logger.info({
        message: 'No backlog expected Txs to process',
      });
      return;
    }
    if (config.mode === MODE.STANDALONE) {
      savedExpectedTxs.forEach(({ tx: txHash, metadata }) => {
        expectedTx[txHash] = metadata;
        incrementExpectedTxsCount();
      });
      // expectedTxsLoaded = true;
      processMissingExpectedTxs();
    } else if (config.mode === MODE.MASTER) {
      delegateToWorker({
        fnName: 'tendermint.loadExpectedTxOnWorker',
        args: [savedExpectedTxs],
      });
    }
  } catch (error) {
    logger.error({
      message: 'Cannot load backlog expected Txs from cache DB',
    });
  }
}

export function loadExpectedTxOnWorker(savedExpectedTxs) {
  savedExpectedTxs.forEach(({ tx: txHash, metadata }) => {
    expectedTx[txHash] = metadata;
    incrementExpectedTxsCount();
  });
  // expectedTxsLoaded = true;
  processMissingExpectedTxs();
}

async function processMissingExpectedTxs() {
  await Promise.all(
    Object.keys(expectedTx).map(async (txHash) => {
      try {
        const result = await tendermintWsPool
          .getConnection()
          .tx(Buffer.from(txHash, 'hex'));
        await processExpectedTx(txHash, result);
      } catch (error) {
        logger.warn({
          message:
            'Error getting Tx for processing missing expected Tx (Tx may still be in mempool or does not exist)',
          txHash,
          err: error,
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

  // Metrics
  // Need to check for in-mem metrics data since loaded expected Txs from cache
  // on server start doesn't have one and their durations shouldn't be collected
  if (expectedTxMetricsData[txHash] != null) {
    metricsEventEmitter.emit(
      'txCommitDuration',
      expectedTxMetricsData[txHash].functionName,
      Date.now() - expectedTxMetricsData[txHash].startTime
    );
    delete expectedTxMetricsData[txHash];
  }

  try {
    const {
      transactParams,
      callbackFnName,
      callbackAdditionalArgs,
    } = expectedTx[txHash];
    delete expectedTx[txHash];
    decrementExpectedTxsCount();
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
        if (mempoolFullOrOutOfToken(retVal.error)) {
          retryOnTransactFail(txHash, null, retVal.error);
        }
      }
      await cacheDb.removeRetryTendermintTransaction(config.nodeId, txHash);
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
    logger.error({ err });
  }
}

export function setTxResultCallbackFnGetter(fn) {
  if (typeof fn !== 'function') {
    throw new Error('Invalid argument type. Must be function.');
  }
  getTxResultCallbackFn = fn;
}

function setTendermintVersion(versionStr) {
  const [majorStr, minorStr, patchStr] = versionStr.split('.');
  const major = parseInt(majorStr);
  const minor = parseInt(minorStr);
  const patch = parseInt(patchStr);
  tendermintVersionStr = versionStr;
  tendermintVersion = {
    major,
    minor,
    patch,
  };
  logger.info({
    message: 'Tendermint version',
    versionStr,
    parsedVersion: tendermintVersion,
  });
}

async function telemetryLogVersions() {
  if (telemetryEnabled) {
    await TelemetryLogger.logTendermintAndABCIVersions({
      nodeId: config.nodeId,
      tendermintVersion: tendermintVersionStr,
      abciVersion: abciVersion,
    });
  }
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
      let status;
      try {
        status = await tendermintWsPool.getConnection().status();
      } catch (error) {
        const err = new CustomError({
          message: 'Cannot get Tendermint status',
          cause: error,
          details: {
            result: status,
          },
        });
        logger.error({ err });
        await utils.wait(backoff.next());
        continue;
      }
      syncing = status.sync_info.catching_up;
      const tendermintVersionStr = status.node_info.version;
      setTendermintVersion(tendermintVersionStr);
      if (syncing === false) {
        logger.info({
          message: 'Tendermint blockchain synced',
        });

        currentChainId = status.node_info.network;
        if (chainId == null) {
          // Save chain ID to file on fresh start
          saveChainId(currentChainId);
          const blockHeight = parseInt(status.sync_info.latest_block_height);
          saveLatestBlockHeight(blockHeight);
        } else if (currentChainId !== chainId) {
          // TODO: Find a better way to get chain history
          // Currently, the check code below will error when connect to a new chain
          // before InitNDID Tx is present on the chain
          // if (!(await utils.hasSeenChain(currentChainId))) {
          logger.info({
            message: 'New chain ID detected',
            newChainId: currentChainId,
            oldChainId: chainId,
          });
          await handleNewChain(currentChainId);
          // }
        }

        const abciInfo = await tendermintWsPool.getConnection().abciInfo();
        abciVersion = {
          version: abciInfo.response.version,
          appVersion: abciInfo.response.app_version,
        };

        telemetryLogVersions();

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
  removeChainIdAndLatestBlockHeightFiles();
  saveChainId(newChainId);
  lastKnownAppHash = null;
  cacheBlocks = {};
  latestBlockHeight = 1;
  latestProcessedBlockHeight = 0;
  saveLatestBlockHeight(1);

  if (node.role === 'proxy') {
    const nodesBehindProxy = await node.getNodesBehindProxyWithKeyOnProxy();
    const nodeIds = nodesBehindProxy.map((node) => node.node_id);
    await Promise.all(
      nodeIds.map((nodeId) =>
        cacheDb.changeAllDataKeysWithExpectedBlockHeight(nodeId, 1)
      )
    );
  } else {
    await cacheDb.changeAllDataKeysWithExpectedBlockHeight(config.nodeId, 1);
  }
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
    if (config.mode === MODE.STANDALONE) {
      await Promise.all(transactRequests.map(retryBacklogTransactRequest));
    } else if (config.mode === MODE.MASTER) {
      transactRequests.forEach((transactRequest) =>
        delegateToWorker({
          fnName: 'tendermint.retryBacklogTransactRequest',
          args: [transactRequest],
        })
      );
    }
  } else {
    logger.info({
      message: 'No backlog transact request to retry',
    });
  }
}

export async function retryBacklogTransactRequest(transactRequest) {
  const { id, transactParams } = transactRequest;
  await transact(transactParams);
  await cacheDb.removeTransactRequestForRetry(config.nodeId, id);
}

export async function loadAndRetryTransact() {
  const retryTransactions = await cacheDb.getAllRetryTendermintTransaction(
    config.nodeId
  );
  if (config.mode === MODE.STANDALONE) {
    await Promise.all(
      retryTransactions.map((txHash, transactParams) =>
        retryTransact(transactParams)
      )
    );
  } else if (config.mode === MODE.MASTER) {
    retryTransactions.forEach((txHash, transactParams) =>
      delegateToWorker({
        fnName: 'tendermint.retryTransact',
        args: [transactParams],
      })
    );
  }
}

export async function retryTransact(transactParams) {
  return transact(transactParams);
}

function checkForSetLastBlock(parsedTransactionsInBlocks) {
  for (let i = parsedTransactionsInBlocks.length - 1; i >= 0; i--) {
    const transactions = parsedTransactionsInBlocks[i].transactions;
    for (let j = transactions.length - 1; j >= 0; j--) {
      const transaction = transactions[j];
      if (!transaction.success) {
        continue;
      }
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
    await tendermintWsPool.waitForAvailableConnection();
    const statusOnSync = await pollStatusUntilSynced();
    if (waitForInitEndedBeforeReady) {
      await pollInitStatusUntilInitEnded();
    }
    eventEmitter.emit('ready', statusOnSync);
    if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
      processMissingBlocks(statusOnSync);
      loadAndRetryBacklogTransactRequests();
    }
    processMissingExpectedTxs();
    reconnecting = false;
  } else {
    const statusOnSync = await pollStatusUntilSynced();
    if (waitForInitEndedBeforeReady) {
      await pollInitStatusUntilInitEnded();
    }
    eventEmitter.emit('ready', statusOnSync);
  }
  metricsEventEmitter.emit('mainWSConnected');
});

tendermintWsClient.on('disconnected', () => {
  connected = false;
  syncing = null;
  blockchainInitialized = false;
  reconnecting = true;
  metricsEventEmitter.emit('mainWSDisconnected');
});

// Tendermint < 0.33.x
tendermintWsClient.on('newBlock_event#event', handleNewBlockEvent);
// Tendermint >= 0.33.x
tendermintWsClient.on('newBlock_event', handleNewBlockEvent);

async function handleNewBlockEvent(error, result) {
  if (error) {
    logger.error({
      message: 'Tendermint NewBlock event subscription error',
      err: error,
    });
    return;
  }

  if (syncing !== false) {
    return;
  }
  const blockHeight = getBlockHeightFromNewBlockEvent(result);
  const block = result.data.value.block;
  cacheBlocks[blockHeight] = block;

  logger.debug({
    message: 'Tendermint NewBlock event received',
    blockHeight,
  });

  processTransactionsInBlock(blockHeight, block);

  if (config.mode === MODE.STANDALONE || config.mode === MODE.MASTER) {
    const appHash = getAppHashFromNewBlockEvent(result);
    await processNewBlock(blockHeight, appHash);
  }
  delete cacheBlocks[blockHeight - 1];
}

async function processTransactionsInBlock(blockHeight, block) {
  const blockResults = await getBlockResults(blockHeight, blockHeight);
  const blockResult = blockResults[0];

  const txs = block.data.txs;

  if (txs == null) {
    return;
  }
  if (txs.length === 0) {
    return;
  }

  await Promise.all(
    txs.map(async (txBase64, index) => {
      const txProtoBuffer = Buffer.from(txBase64, 'base64');
      const txHash = sha256(txProtoBuffer).toString('hex');
      if (expectedTx[txHash] == null) return;
      let deliverTxResult;
      if (tendermintVersion.major === 0 && tendermintVersion.minor >= 33) {
        deliverTxResult = blockResult.txs_results[index];
      } else if (
        tendermintVersion.major === 0 &&
        tendermintVersion.minor === 32
      ) {
        deliverTxResult = blockResult.results.deliver_tx[index];
      } else {
        deliverTxResult = blockResult.results.DeliverTx[index];
      }
      await processExpectedTx(
        txHash,
        {
          height: blockHeight,
          deliverTxResult,
        },
        true
      );
    })
  );
}

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
      // messages that arrived before 'NewBlock' event
      // including messages between the start of missing block's height
      // and the block before latest block height
      // (not only just (current height - 1) in case 'NewBlock' events are missing)
      // NOTE: Tendermint always create an ending empty block. A block with transactions and
      // a block that signs the previous block which indicates that the previous block is valid
      const fromHeight = blockHeight - 1 - missingBlockCount;
      const toHeight = blockHeight - 1;

      let processingBlocksStr;
      if (fromHeight === toHeight) {
        processingBlocksStr = `${fromHeight}`;
      } else {
        processingBlocksStr = `${fromHeight}-${toHeight}`;
      }
      processingBlocks[processingBlocksStr] = null;
      const blocksToProcess = toHeight - fromHeight + 1;
      addProcessingBlocksCount(blocksToProcess);

      const parsedTransactionsInBlocks = (
        await getParsedTxsInBlocks(fromHeight, toHeight, false)
      ).filter(({ transactions }) => transactions.length >= 0);
      checkForSetLastBlock(parsedTransactionsInBlocks);

      if (handleTendermintNewBlock) {
        await handleTendermintNewBlock(
          fromHeight,
          toHeight,
          parsedTransactionsInBlocks
        );
      }

      delete processingBlocks[processingBlocksStr];
      subtractProcessingBlocksCount(blocksToProcess);
    }
    lastKnownAppHash = appHash;
    saveLatestBlockHeight(blockHeight);
  }
}

async function getParsedTxsInBlocks(fromHeight, toHeight, withTxHash) {
  const [blocks, blockResults] = await Promise.all([
    getBlocks(fromHeight, toHeight),
    getBlockResults(fromHeight, toHeight),
  ]);
  const parsedTransactionsInBlocks = blocks.map((block, blockIndex) => {
    const height = parseInt(block.header.height);

    const transactions = getTransactionListFromBlock(block, withTxHash);

    const transactionsWithDeliverTxResult = transactions.map(
      (transaction, index) => {
        let deliverTxResult;
        let success;
        if (tendermintVersion.major === 0 && tendermintVersion.minor >= 33) {
          deliverTxResult = blockResults[blockIndex].txs_results[index];
          const successAttribute = deliverTxResult.events
            .find((event) => event.type === 'did.result')
            .attributes.find((attribute) => attribute.key === successBase64);
          if (successAttribute) {
            success = successAttribute.value === trueBase64;
          } else {
            success = false;
          }
        } else if (
          tendermintVersion.major === 0 &&
          tendermintVersion.minor === 32
        ) {
          deliverTxResult = blockResults[blockIndex].results.deliver_tx[index];
          const successAttribute = deliverTxResult.events
            .find((event) => event.type === 'did.result')
            .attributes.find((attribute) => attribute.key === successBase64);
          if (successAttribute) {
            success = successAttribute.value === trueBase64;
          } else {
            success = false;
          }
        } else {
          deliverTxResult = blockResults[blockIndex].results.DeliverTx[index];
          const successTag = deliverTxResult.tags.find(
            (tag) => tag.key === successBase64
          );
          if (successTag) {
            success = successTag.value === trueBase64;
          } else {
            success = false;
          }
        }

        return {
          ...transaction,
          deliverTxResult,
          success,
        };
      }
    );

    return {
      height,
      transactions: transactionsWithDeliverTxResult,
    };
  });
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
        const result = await tendermintWsPool.getConnection().block(height);
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
    heights.map((height) =>
      tendermintWsPool.getConnection().blockResults(height)
    )
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

  const height = parseInt(result.height);

  const deliverTxResult = fromEvent ? result.deliverTxResult : result.tx_result;

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

  try {
    const result = await tendermintWsPool
      .getConnection()
      .abciQuery(queryProtoBuffer, height);
    return getQueryResult(result);
  } catch (error) {
    if (error.message === 'JSON-RPC ERROR') {
      throw new CustomError({
        errorType: errorType.TENDERMINT_QUERY_JSON_RPC_ERROR,
        details: error.details,
      });
    } else {
      throw error;
    }
  }
}

//========================== retry ===========================

function mempoolFullOrOutOfToken(error) {
  return (
    error.code === errorType.ABCI_NOT_ENOUGH_TOKEN.code ||
    error.code === errorType.TENDERMINT_MEMPOOL_FULL.code
  );
}

async function retryOnTransactFail(txHash, transactParams, error) {
  logger.warn({
    message: 'Transact with retry error',
    err: error,
  });

  if (!transactParams) {
    transactParams = await cacheDb.getRetryTendermintTransaction(
      config.nodeId,
      txHash
    );
    if (transactParams === null) return;
  }

  const {
    nodeId,
    fnName,
    params,
    callbackFnName,
    callbackAdditionalArgs,
    useMasterKey,
    saveForRetryOnChainDisabled,
    retryOnFail,
    counter,
  } = transactParams;

  const backoff = new ExponentialBackoff({
    min: 5000,
    max: 180000,
    factor: 2,
    jitter: 0.2,
  });
  let nextRetry = backoff.next();
  for (let i = 0; i < counter; i++) {
    nextRetry = backoff.next();
  }

  // notifyError({
  //   nodeId,
  //   getCallbackUrlFnName: node.role + '.getErrorCallbackUrl',
  //   action: 'tendermintTx:' + fnName,
  //   error: error,
  // });

  logger.info({
    message: 'Retrying transact',
    txHash,
    nodeId,
    fnName,
    retryCount: counter,
    nextRetry,
  });

  setTimeout(
    () =>
      transact({
        nodeId,
        fnName,
        params,
        callbackFnName,
        callbackAdditionalArgs,
        useMasterKey,
        saveForRetryOnChainDisabled,
        retryOnFail,
        counter: counter + 1,
      }),
    nextRetry
  );
}

//=====================================================

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
  retryOnFail = false,
  counter = 0,
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
  const metadata = {
    transactParams,
    callbackFnName,
    callbackAdditionalArgs,
  };
  expectedTx[txHash] = metadata;
  incrementExpectedTxsCount();
  await cacheDb.setExpectedTxMetadata(config.nodeId, txHash, metadata);
  expectedTxMetricsData[txHash] = {
    startTime: Date.now(),
    functionName: fnName,
  };

  if (retryOnFail && counter === 0) {
    await cacheDb.setRetryTendermintTransaction(config.nodeId, txHash, {
      ...transactParams,
      retryOnFail,
      counter,
    });
  }

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
    const responseResult = await tendermintWsPool
      .getConnection()
      .broadcastTxSync(txProtoBuffer);
    const broadcastTxSyncResult = getBroadcastTxSyncResult(responseResult);
    if (waitForCommit) {
      const result = await promise;
      return result;
    }
    return broadcastTxSyncResult;
  } catch (error) {
    delete expectedTx[txHash];
    delete expectedTxMetricsData[txHash];
    decrementExpectedTxsCount();
    metricsEventEmitter.emit('txTransactFail');
    await cacheDb.removeExpectedTxMetadata(config.nodeId, txHash);
    if (
      error.code === errorType.ABCI_CHAIN_DISABLED.code &&
      saveForRetryOnChainDisabled
    ) {
      await handleBlockchainDisabled(transactParams);
      return { chainDisabledRetryLater: true };
    } else if (retryOnFail && mempoolFullOrOutOfToken(error)) {
      return retryOnTransactFail(
        txHash,
        {
          ...transactParams,
          retryOnFail,
          counter,
        },
        error
      );
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

function getTransactionListFromBlock(block, withTxHash) {
  const txs = block.data.txs; // array of transactions in the block base64 encoded
  // const height = parseInt(block.header.height);

  if (txs == null) {
    return [];
  }

  const transactions = txs.map((txBase64) => {
    const txProtoBuffer = Buffer.from(txBase64, 'base64');
    const txObject = TendermintTx.decode(txProtoBuffer);
    const args = JSON.parse(txObject.params);
    let txHash;
    if (withTxHash) {
      txHash = sha256(txProtoBuffer).toString('hex');
    }
    return {
      fnName: txObject.method,
      args,
      nodeId: txObject.node_id,
      txHash,
    };
  });

  return transactions;
}

function getBlockHeightFromNewBlockHeaderEvent(result) {
  return parseInt(result.data.value.header.height);
}

function getBlockHeightFromNewBlockEvent(result) {
  return parseInt(result.data.value.block.header.height);
}

function getAppHashFromNewBlockEvent(result) {
  return result.data.value.block.header.app_hash;
}

function incrementExpectedTxsCount() {
  expectedTxsCount++;
  metricsEventEmitter.emit('expectedTxsCount', expectedTxsCount);
}

function decrementExpectedTxsCount() {
  expectedTxsCount--;
  metricsEventEmitter.emit('expectedTxsCount', expectedTxsCount);
}

export function getExpectedTxsCount() {
  return expectedTxsCount;
}

export function getExpectedTxHashes() {
  return Object.keys(expectedTx);
}

function addProcessingBlocksCount(valueToAdd) {
  processingBlocksCount += valueToAdd;
  metricsEventEmitter.emit('processingBlocksCount', processingBlocksCount);
}

function subtractProcessingBlocksCount(valueToSubtract) {
  processingBlocksCount -= valueToSubtract;
  metricsEventEmitter.emit('processingBlocksCount', processingBlocksCount);
}

export function getProcessingBlocksCount() {
  return processingBlocksCount;
}

export function getProcessingBlocks() {
  return Object.keys(processingBlocks);
}
