import fs from 'fs';
import crypto from 'crypto';
import * as cryptoUtils from './crypto';
import * as config from '../config';
import fetch from 'node-fetch';

let nonce = Date.now() % 10000;
let signatureCallback = false;

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getNonce() {
  // TODO
  return (nonce++).toString();
}

export function hash(stringToHash) {
  return cryptoUtils.hash(stringToHash);
}

export function decryptAsymetricKey(cipher) {
  // TODO: implement decryption with callback decrypt? no design yet... (HSM)
  const [encryptedSymKey, encryptedMessage] = cipher.split('|');
  const privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
  const symKeyBuffer = cryptoUtils.privateDecrypt(privateKey, encryptedSymKey);
  return cryptoUtils.decryptAES256GCM(symKeyBuffer, encryptedMessage, false);
}

export function encryptAsymetricKey(publicKey, message) {
  const symKeyBuffer = crypto.randomBytes(32);
  const encryptedSymKey = cryptoUtils.publicEncrypt(publicKey, symKeyBuffer);
  const encryptedMessage = cryptoUtils.encryptAES256GCM(
    symKeyBuffer,
    message,
    false // Key derivation is not needed since key is cryptographically random generated and use only once
  );
  return encryptedSymKey + '|' + encryptedMessage;
}

export function generateIdentityProof(data) {
  return cryptoUtils.generateIdentityProof(data);
}

export function setSignatureCallback(url) {
  //comment out because no decrypt yet...
  //signatureCallback = url;
}

async function createSignatureByCallback() {
  //TODO implement this properly
  //MUST be base64 format
  let response = await fetch(signatureCallback, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      node_id: config.nodeId,
      //request_message: 'string',
      //request_hash: 'string',
      hash_method: 'SHA256',
      //key_type: 'string',
      //sign_method: 'string'
    }),
  });
  return await response.text();
}

export async function createSignature(data, nonce = '') {
  if (signatureCallback)
    return await createSignatureByCallback(JSON.stringify(data) + nonce);
  let privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
  return cryptoUtils.createSignature(data, nonce, privateKey);
}

export function createRequestId() {
  return cryptoUtils.randomHexBytes(32);
}
