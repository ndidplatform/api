import logger from '../logger';

import * as tendermintClient from './client';
import * as utils from '../utils';
import * as config from '../config';

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
