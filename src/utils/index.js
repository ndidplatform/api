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

//================================== zk proof ==================================

export function securelyGenerateParamsForZk({
  secret, 
  namespace, 
  identifier,
  generating_function,
  bound_value,
  prime_modulo,

}) {
  if(!prime_modulo) prime_modulo = generateRandomBigPrime();
  if(!generating_function && !bound_value) {
    let [ g, q ] = generateingFunctionOfGroup(prime_modulo);
    generating_function = g;
    bound_value = q;
  }

  let secretBigInt = numericStringToBigInt(secret);
  let sidBigInt = hexStringToBigInt(transformSidToRequiredLength(namespace + ':' + identifier));

  let power = multiplyModBigInt(secretBigInt,sidBigInt,bound_value);
  let commitment = powerModBigInt(generating_function, power, prime_modulo);
  
  return {
    generating_function,
    prime_modulo,
    bound_value,
    commitment
  };
}

function transformSidToRequiredLength(sid) {
  const requiredLength = 40; //40 bytes = 320 bits

  let firstHash = hash(sid);
  let firstHashBytes = Buffer.from(firstHash, 'hex');
  let secondHash = hash(firstHash);
  let secondHashBytes = Buffer.from(secondHash, 'hex');
  
  let firstHalfResult = firstHashBytes.slice(firstHashBytes.length - requiredLength/2);
  let secondHalfResult = secondHashBytes.slice(secondHashBytes.length - requiredLength/2);

  return firstHalfResult.toString('hex') + secondHalfResult.toString('hex');
}

function generateingFunctionOfGroup(prime) {
  //TODO implement this (return bigInt)
  return ['70322', '1031'];
}

function generateRandomBigPrime() {
  //TODO implement this (return bigInt)
  return '88667'; //is this big enough?
}

function hexStringToBigInt(str) {
  //TODO implement this, example input 'CAFEDEADBEEF40C0FFEE'
  return '0';
}

function numericStringToBigInt(str) {
  //TODO implement this, example input '12345678901234567890'
  return '0';
}

function powerModBigInt(base, power, modulo) {
  //TODO implement this
  return '0';
}

function multiplyModBigInt(v1, v2, modulo) {
  //TODO implement this
  return '0';
}