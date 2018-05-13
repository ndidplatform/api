import * as crypto from './crypto';
import fs from 'fs';
import * as config from '../config';
import fetch from 'node-fetch';

let nonce = Date.now() % 10000;
let signatureCallback = false;

export function getNonce() {
  // TODO
  return (nonce++).toString();
}

export function hash(stringToHash) {
  return crypto.hash(stringToHash);
}

export function decryptAsymetricKey(cipher) {
  // TODO implement decryption with callback decrypt? no design yet...
  let [encryptedSymKey, encryptedMessage] = cipher.split('|');
  let privateKey = fs.readFileSync(config.PRIVATE_KEY_PATH,'utf8');
  let symKey = crypto.privateDecrypt(privateKey, encryptedSymKey);
  return crypto.decryptAES256GCM(symKey, encryptedMessage);
}

export function encryptAsymetricKey(publicKey, message) {
  let symKey = crypto.randomHexBytes(32);
  let encryptedSymKey = crypto.publicEncrypt(publicKey, symKey);
  let encryptedMessage = crypto.encryptAES256GCM(symKey, message);
  return encryptedSymKey + '|' + encryptedMessage;
}

export function generateIdentityProof(data) {
  return crypto.generateIdentityProof(data);
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
    })
  });
  return await response.text();
}

export async function createSignature(data, nonce = '') {
  if(signatureCallback)
    return await createSignatureByCallback(JSON.stringify(data) + nonce);
  let privateKey = fs.readFileSync(config.PRIVATE_KEY_PATH,'utf8');
  return crypto.createSignature(data, nonce, privateKey);
}

export function createRequestId() {
  return crypto.createRequestId();
}
