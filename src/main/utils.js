import fetch from 'node-fetch';

import { TENDERMINT_ADDRESS } from '../config';

let nonce = Date.now() % 10000;


function retrieveResult(obj, isQuery) {
  if (obj.error) {
    console.error(obj.error);
    return [obj.error, -1];
  }

  if (isQuery) {
    if(obj.result.response.log === 'not found') {
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

export async function hash(stringToHash) {
  // TODO implement secure hashing
  return 'Hash(' + stringToHash + ')';
}

export async function decryptAsymetricKey(key, message) {
  // TODO implement decryption
  return message.slice(message.indexOf('(') + 1, message.length - 1);
}

export async function encryptAsymetricKey(key, message) {
  // TODO implement encryption
  return 'Encrypt_with_' + key + '(' + message + ')';
}

export function generateIdentityProof(data) {
  // TODO
  return '<some-voodoo-happen-here>';
}

export async function createRequestId(privkey, data, nonce) {
  // TODO implement real request_id generating algorithm
  return await hash(
    'Concat_with_nonce_' +
      nonce +
      '(' +
      Buffer.from(JSON.stringify(data)).toString('base64') +
      ')'
  );
}

export function getNonce() {
  // TODO
  return (nonce++).toString();
}

export function getTransactionListFromTendermintNewBlockEvent(result) {
  const txs = result.data.data.block.data.txs; // array of transactions in the block base64 encoded
  //const height = result.data.data.block.header.height;
  
  const transactions = txs.map((tx) => {
    // Decode base64 2 times because we send transactions to tendermint in base64 format
    const txContentBase64 = Buffer.from(tx, 'base64').toString();
    const txContent = Buffer.from(txContentBase64, 'base64').toString().split('|');
    return {
      fnName: txContent[0],
      args: JSON.parse(txContent[1])
    };
  });

  return transactions;
}

export function getHeightFromTendermintNewBlockEvent(result) {
  return result.data.data.block.header.height;
}

export async function queryChain(fnName, data, requireHeight) {
  let encoded = Buffer.from(fnName + '|' + JSON.stringify(data)).toString(
    'base64'
  );

  let result = await fetch(`http://${TENDERMINT_ADDRESS}/abci_query?data="${encoded}"`);
  let [value, currentHeight] = retrieveResult(await result.json(), true);
  if(requireHeight) return [value, currentHeight];
  return value;
}

export async function updateChain(fnName, data, nonce) {
  let encoded = Buffer.from(
    fnName + '|' + JSON.stringify(data) + '|' + nonce
  ).toString('base64');

  let result = await fetch(`http://${TENDERMINT_ADDRESS}/broadcast_tx_commit?tx="${encoded}"`);
  return retrieveResult(await result.json());
}
