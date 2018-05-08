import * as tendermintClient from './client';
import * as utils from '../main/utils';

function getQueryResult(response) {
  if (response.error) {
    console.error(response.error);
    return [response.error, -1];
  }

  if (response.result.response.log === 'not found') {
    return [undefined, -1];
  }
  let result = Buffer.from(response.result.response.value, 'base64').toString();
  return [JSON.parse(result), parseInt(response.result.response.height)];
}

function getTransactResult(response) {
  console.log('===>',response)
  if (response.error) {
    console.error(response.error);
    return [response.error, -1];
  }

  if (response.result.deliver_tx.log !== 'success') {
    console.error('Update chain failed:', response);
  }
  return [response.result.deliver_tx.log === 'success', response.result.height];
}

export async function query(fnName, data, requireHeight) {
  const queryData = fnName + '|' + JSON.stringify(data);

  try {
    const response = await tendermintClient.abciQuery(queryData);
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

export async function transact(fnName, data, nonce, node_id) {
  const tx = fnName + '|' + JSON.stringify(data) + '|' + nonce + '|' + 
  utils.createSignature(data,nonce) + '|' + node_id || process.env.node_id;

  try {
    const response = await tendermintClient.broadcastTxCommit(tx);
    return getTransactResult(response);
  } catch (error) {
    // TODO: error handling
    throw error;
  }
}

export function getTransactionListFromTendermintNewBlockEvent(result) {
  const txs = result.data.data.block.data.txs; // array of transactions in the block base64 encoded
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

export function getHeightFromTendermintNewBlockEvent(result) {
  return result.data.data.block.header.height;
}
