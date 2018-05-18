import path from 'path';
import fs from 'fs';

import logger from '../logger';

import * as tendermintClient from './client';
import TendermintWsClient from './wsClient';
import * as utils from '../utils';
import * as config from '../config';

let handleTendermintNewBlockHeaderEvent;

const latestBlockHeightFilepath = path.join(
  __dirname,
  '..',
  '..',
  `latest-block-height-${config.nodeId}`
);

export let latestBlockHeight = null;

try {
  latestBlockHeight = fs.readFileSync(latestBlockHeightFilepath, 'utf8');
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
  fs.writeFile(latestBlockHeightFilepath, height, (err) => {
    if (err) {
      logger.error({
        message: 'Cannot write latest block height file',
        error: err,
      });
    }
  });
}

export function setTendermintNewBlockHeaderEventHandler(handler) {
  handleTendermintNewBlockHeaderEvent = handler;
}

export const tendermintWsClient = new TendermintWsClient();

tendermintWsClient.on('connected', () => {
  // tendermintWsClient.getStatus();
});

tendermintWsClient.on('newBlockHeader#event', async (error, result) => {
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
  if (response.error) {
    logger.debug({
      message: 'tendermint query error',
      error: response.error,
    });
    return [response.error, -1];
  }

  if (response.result.response.log === 'not found') {
    return [undefined, -1];
  }
  let result = Buffer.from(response.result.response.value, 'base64').toString();
  return [JSON.parse(result), parseInt(response.result.response.height)];
}

function getTransactResult(response) {
  if (response.error) {
    logger.debug({
      message: 'tendermint transact error',
      error: response.error,
    });
    return [response.error, -1];
  }

  if (response.result.deliver_tx.log !== 'success') {
    logger.error({
      message: 'tendermint transact failed',
      response
    });
  }
  return [response.result.deliver_tx.log === 'success', response.result.height];
}

export async function query(fnName, data, requireHeight) {
  const queryData = fnName + '|' + JSON.stringify(data);

  const dataBase64Encoded = Buffer.from(queryData).toString('base64');

  try {
    const response = await tendermintClient.abciQuery(dataBase64Encoded);
    const [value, currentHeight] = getQueryResult(response);
    if (requireHeight) {
      return [value, currentHeight];
    }
    return value;
  } catch (error) {
    // TODO: error handling
    throw error;
  }
}

export async function transact(fnName, data, nonce) {
  const tx = fnName + '|' + JSON.stringify(data) + '|' + nonce + '|' + 
    await utils.createSignature(data,nonce) + '|' + config.nodeId;

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
