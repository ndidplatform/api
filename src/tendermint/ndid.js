import * as tendermintClient from './client';

function retrieveResult(obj, isQuery) {
  if (obj.error) {
    console.error(obj.error);
    return [obj.error, -1];
  }

  if (isQuery) {
    if (obj.result.response.log === 'not found') {
      return [undefined, -1];
    }
    let result = Buffer.from(obj.result.response.value, 'base64').toString();
    return [JSON.parse(result), parseInt(obj.result.response.height)];
  }

  if (obj.result.deliver_tx.log !== 'success') {
    console.error('Update chain failed:', obj);
  }
  return [obj.result.deliver_tx.log === 'success', obj.result.height];
}

export async function query(fnName, data, requireHeight) {
  const queryData = fnName + '|' + JSON.stringify(data);

  try {
    const response = await tendermintClient.abciQuery(queryData);
    const [value, currentHeight] = retrieveResult(response, true);
    if (requireHeight) return [value, currentHeight];
    return value;
  } catch (error) {
    // TODO: error handling
    throw error;
  }
}

export async function transact(fnName, data, nonce) {
  const tx = fnName + '|' + JSON.stringify(data) + '|' + nonce;

  try {
    const response = await tendermintClient.broadcastTxCommit(tx);
    return retrieveResult(response);
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
