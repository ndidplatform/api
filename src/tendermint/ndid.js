import path from 'path';
import fs from 'fs';

import CustomError from '../error/customError';
import errorCode from '../error/code';
import errorMessage from '../error/message';
import logger from '../logger';

import * as tendermintClient from './client';
import TendermintWsClient from './wsClient';
import * as utils from '../utils';
import * as config from '../config';

let handleTendermintNewBlockHeaderEvent;

export let syncing = null;
export let connected = false;

let readyPromise;
export let ready = new Promise((resolve) => {
  readyPromise = { resolve };
});

const latestBlockHeightFilepath = path.join(
  __dirname,
  '..',
  '..',
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
async function pollStatusUtilSynced() {
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
        readyPromise.resolve();
        readyPromise = null;
        break;
      }
      await utils.wait(1000);
    }
  }
}

export const tendermintWsClient = new TendermintWsClient();

tendermintWsClient.on('connected', () => {
  connected = true;
  pollStatusUtilSynced();
});

tendermintWsClient.on('disconnected', () => {
  connected = false;
  syncing = null;
  ready = new Promise((resolve) => {
    readyPromise = { resolve };
  });
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

export function getBlocks(fromHeight, toHeight) {
  return tendermintWsClient.getBlocks(fromHeight, toHeight);
}

function getQueryResult(response) {
  logger.debug({
    message: 'Tendermint query result',
    response,
  });
  if (response.error) {
    throw new CustomError({
      message: errorMessage.TENDERMINT_QUERY_JSON_RPC_ERROR,
      code: errorCode.TENDERMINT_QUERY_JSON_RPC_ERROR,
      details: response.error,
    });
  }

  // const currentHeight = parseInt(response.result.response.height);

  if (response.result.response.log === 'not found') {
    return null;
  }

  if (response.result.response.value == null) {
    throw new CustomError({
      message: errorMessage.TENDERMINT_QUERY_ERROR,
      code: errorCode.TENDERMINT_QUERY_ERROR,
      details: response.result,
    });
  }

  const result = Buffer.from(
    response.result.response.value,
    'base64'
  ).toString();
  try {
    return JSON.parse(result);
  } catch (error) {
    throw new CustomError({
      message: errorMessage.TENDERMINT_QUERY_RESULT_JSON_PARSE_ERROR,
      code: errorCode.TENDERMINT_QUERY_RESULT_JSON_PARSE_ERROR,
      cause: error,
    });
  }
}

function getTransactResult(response) {
  logger.debug({
    message: 'Tendermint transact result',
    response,
  });
  if (response.error) {
    throw new CustomError({
      message: errorMessage.TENDERMINT_TRANSACT_JSON_RPC_ERROR,
      code: errorCode.TENDERMINT_TRANSACT_JSON_RPC_ERROR,
      details: response.result,
    });
  }

  const height = response.result.height;

  if (response.result.deliver_tx.log !== 'success') {
    throw new CustomError({
      message: errorMessage.TENDERMINT_TRANSACT_ERROR,
      code: errorCode.TENDERMINT_TRANSACT_ERROR,
      details: {
        abciCode: response.result.deliver_tx.code,
        height,
      },
    });
  }
  return {
    height,
  };
}

export async function query(fnName, data) {
  logger.debug({
    message: 'Tendermint query',
    fnName,
    data,
  });

  const queryData = fnName + '|' + JSON.stringify(data);

  const dataBase64Encoded = Buffer.from(queryData).toString('base64');

  try {
    const response = await tendermintClient.abciQuery(dataBase64Encoded);
    return getQueryResult(response);
  } catch (error) {
    // TODO: error handling
    throw error;
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
    const response = await tendermintClient.broadcastTxCommit(txBase64Encoded);
    return getTransactResult(response);
  } catch (error) {
    // TODO: error handling
    throw error;
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

export function getNodeIdFromNewBlockHeaderEvent(result) {
  //Todo
  return 'someId'; //result.data.value.header.height;
}
