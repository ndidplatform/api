import fetch from 'node-fetch';

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
    if(obj.result.response.log === 'not found') return;
    let result = Buffer.from(obj.result.response.value, 'base64').toString();
    return [JSON.parse(result), parseInt(obj.result.response.height)];
  } else if (obj.result.deliver_tx.log === 'success') return true;
  else {
    console.error('Update chain failed:', obj);
    return false;
  }
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

export async function queryChain(fnName, data, requireHeight) {
  let encoded = Buffer.from(fnName + '|' + JSON.stringify(data)).toString(
    'base64'
  );

  let result = await fetch(logicUrl + '/abci_query?data="' + encoded + '"');
  let [value, currentHeight] = retrieveResult(await result.json(), true);
  if(requireHeight) return [value, currentHeight];
  return value;
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
