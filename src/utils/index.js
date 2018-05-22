import fs from 'fs';
import crypto from 'crypto';
import * as cryptoUtils from './crypto';
import * as config from '../config';
import fetch from 'node-fetch';

let nonce = Date.now() % 10000;
let signatureCallback = false;
const saltByteLength = 8;
const saltStringLength = saltByteLength*2;

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

export function hashWithRandomSalt(stringToHash) {
  let saltByte = crypto.randomBytes(saltByteLength);
  let saltString = saltByte.toString('hex');
  return saltString + hash(saltString + stringToHash);
}

export function compareSaltedHash({saltedHash, plain}) {
  let saltString = saltedHash.substring(0,saltStringLength);
  return saltedHash === saltString + hash(saltString + plain);
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

export function securelyGenerateParamsForZk({
  secret, 
  namespace, 
  identifier,
  generating_function,
  prime_modulo
}) {
  if(!prime_modulo) prime_modulo = generateRandomBigPrime();
  if(!generating_function) generating_function = generateingFunctionOfGroup(prime_modulo);

  let secretBigInt = stringToBigInt(secret);
  let sidBigInt = stringToBigInt(namespace + ':' + identifier);

  let commitment = powerModBigInt( 
    powerModBigInt(generating_function, secretBigInt, prime_modulo), 
    sidBigInt, 
    prime_modulo 
  );
  return {
    generating_function,
    prime_modulo,
    commitment
  };
}

function generateingFunctionOfGroup(prime) {
  //TODO implement this
  return 0;
}

function generateRandomBigPrime() {
  //TODO implement this
  return 2; //is this big enough?
}

function stringToBigInt(str) {
  //TODO implement this
  return 0;
}

function powerModBigInt(base, power, modulo) {
  //TODO implement this
  return 0;
}