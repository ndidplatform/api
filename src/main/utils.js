import crypto from 'crypto';
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
  return crypto.createHash('sha256').update(stringToHash, 'utf8').digest().toString('base64');
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

export function setSignatureCallback(url) {
  signatureCallback = url;
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

export async function createSignature(data, nonce) {
  if(signatureCallback) return await createSignatureByCallback(JSON.stringify(data) + nonce);
  let privKey = fs.readFileSync(config.PRIVATE_KEY_PATH,'utf8');
  return crypto.createSign('SHA256').update(JSON.stringify(data) + nonce).sign(privKey,'base64');
}

export function createRequestId(privkey, data, nonce) {
  return crypto.randomBytes(32).toString('hex');
}
