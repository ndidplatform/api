import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let nonce = Date.now() % 10000;

export function getNonce() {
  // TODO
  return (nonce++).toString();
}

export function hash(stringToHash) {
  // TODO implement secure hashing
  return 'Hash(' + stringToHash + ')';
}

export function decryptAsymetricKey(key, message) {
  // TODO implement decryption
  return message.slice(message.indexOf('(') + 1, message.length - 1);
}

export function encryptAsymetricKey(key, message) {
  // TODO implement encryption
  return 'Encrypt_with_' + key + '(' + message + ')';
}

export function generateIdentityProof(data) {
  // TODO
  return '<some-voodoo-happen-here>';
}

export function createSignature(data, nonce) {
  //TODO call signature if not expose private key,
  //TODO get private key according to role and nodeid?
  let privKey = fs.readFileSync(path.join(__dirname, '..', 'devKey', 'ndid', 'ndid'),'utf8');
  return crypto.createSign('SHA256').update(JSON.stringify(data) + nonce).sign(privKey,'base64');
}

export function createRequestId(privkey, data, nonce) {
  // TODO implement real request_id generating algorithm
  return hash(
    'Concat_with_nonce_' +
      nonce +
      '(' +
      Buffer.from(JSON.stringify(data)).toString('base64') +
      ')'
  );
}
