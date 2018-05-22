import path from 'path';
import fs from 'fs';

import logger from '../logger';

import * as tendermintClient from './client';
import TendermintWsClient from './wsClient';
import * as utils from '../utils';
import * as config from '../config';

let handleTendermintNewBlockHeaderEvent;

export let syncing = null;

let readyPromise;
export const ready = new Promise((resolve) => {
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
    message: 'Waiting for tendermint to finish syncing blockchain',
  });
  if (syncing == null || syncing === true) {
    for (;;) {
      const status = await tendermintWsClient.getStatus();
      syncing = status.syncing;
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
  pollStatusUtilSynced();
});

tendermintWsClient.on('newBlockHeader#event', async (error, result) => {
  if (syncing !== false) {
    return;
  }
  const blockHeight = result.data.data.header.height;
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
    logger.error({
      message: 'Tendermint JSON-RPC call error (query)',
      response,
    });
    throw {
      error: response.error,
      // TODO: error code
      // code: ,
    };
  }

  // const currentHeight = parseInt(response.result.response.height);

  if (response.result.response.value == null) {
    logger.error({
      message: 'Tendermint query failed',
      response,
    });
    throw {
      error: response.result.response.log,
      // currentHeight,
      // TODO: error code
      // code: ,
    };
  }

  // if (response.result.response.log === 'not found') {
  //   return {
  //     error: response.result.response.log,
  //   };
  // }
  const result = Buffer.from(
    response.result.response.value,
    'base64'
  ).toString();
  try {
    return JSON.parse(result);
  } catch (error) {
    logger.error({
      message: 'Cannot parse Tendermint query result JSON',
      result,
    });
    throw {
      error: 'Cannot parse Tendermint query result JSON',
    };
  }
}

function getTransactResult(response) {
  logger.debug({
    message: 'Tendermint transact result',
    response,
  });
  if (response.error) {
    logger.error({
      message: 'Tendermint JSON-RPC call error (transact)',
      response,
    });
    throw {
      error: response.error,
      // TODO: error code
      // code: ,
    };
  }

  const height = response.result.height;

  if (response.result.deliver_tx.log !== 'success') {
    logger.error({
      message: 'Tendermint transact failed',
      response,
    });
    throw {
      error: { code: response.result.deliver_tx.code },
      height,
      // TODO: error code
      // code: ,
    };
  }
  return {
    success: response.result.deliver_tx.log === 'success',
    height,
  };
}

export async function query(fnName, data) {
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

export async function transact(fnName, data, nonce) {
  const tx =
    fnName +
    '|' +
    JSON.stringify(data) +
    '|' +
    nonce +
    '|' +
    (await utils.createSignature(data, nonce)) +
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
  return result.data.data.header.height;
}
