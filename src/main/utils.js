import fetch from 'node-fetch';
import crypto from 'crypto';

let nonce = Date.now() % 10000;
const logicUrl = process.env.TENDERMINT_ADDRESS || ('http://localhost:' + defaultTendermintPort()) ;
  
function defaultTendermintPort() {
  if(process.env.ROLE === 'rp') return '45000';
  if(process.env.ROLE === 'idp') return '45001';
  if(process.env.ROLE === 'as') return '45002';
}

function retrieveResult(obj, isQuery) {
  if (obj.error) {
    console.error(obj.error);
    return obj.error;
  }
  if (isQuery) {
    let log = Buffer.from(obj.result.response.value, 'base64').toString();
    if(log === 'not found') {
      //query until next block
      return log;
    }
    let result = Buffer.from(obj.result.response.value, 'base64').toString();
    return JSON.parse(result);
  } else if (obj.result.deliver_tx.log === 'success') return true;
  else {
    console.error('Update chain failed:', obj);
    return false;
  }
}

export async function hash(stringToHash) {
  return crypto.createHash('sha256').update(stringToHash, 'utf8').digest().toString('base64');
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

export async function createRequestId() {
  return crypto.randomBytes(32).toString('hex');
}

export function getNonce() {
  // TODO
  return (nonce++).toString();
}

export async function getBlockHeight() {
  let response = await fetch(logicUrl + '/status');
  let jsonResponse = await response.json();
  return parseInt(jsonResponse.result.latest_block_height);
} 

export async function queryChain(fnName, data) {
  let encoded = Buffer.from(fnName + '|' + JSON.stringify(data)).toString(
    'base64'
  );

  //workaround when event was fired before block was commited to chain, should fix
  let terminateHeight = await getBlockHeight() + 2;
  let blockHeight,bcResult;

  do {
    let [result, _blockHeight] = await Promise.all([
      fetch(logicUrl + '/abci_query?data="' + encoded + '"'),
      getBlockHeight()
    ]);
    bcResult = retrieveResult(await result.json(), true);
    blockHeight = _blockHeight;
    if(bcResult !== 'not found') { 
      return bcResult;
    }
    else {
      await new Promise((resolve) => { setTimeout(resolve,1000) });
    }
  }
  while(blockHeight < terminateHeight);
  return 'not found'; //block is really lost
}

export async function updateChain(fnName, data, nonce) {
  let encoded = Buffer.from(
    fnName + '|' + JSON.stringify(data) + '|' + nonce
  ).toString('base64');

  let result = await fetch(
    logicUrl + '/broadcast_tx_commit?tx="' + encoded + '"'
  );
  return retrieveResult(await result.json());
}
