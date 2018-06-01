import fs from 'fs';
import crypto from 'crypto';
import * as cryptoUtils from './crypto';
import * as config from '../config';
import fetch from 'node-fetch';
import bignum from 'bignum';
import { spawnSync } from 'child_process';

let nonce = Date.now() % 10000;
let signatureCallback = false;
let masterSignatureCallback = false;
let decryptCallback = false;
const saltByteLength = 8;
const saltStringLength = saltByteLength*2;

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomHexBytes(length) {
  return cryptoUtils.randomHexBytes(length);
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

export async function decryptAsymetricKey(cipher) {
  // TODO: implement decryption with callback decrypt? no design yet... (HSM)
  const [encryptedSymKey, encryptedMessage] = cipher.split('|');
  let symKeyBuffer;

  if(decryptCallback) {
    let response = await fetch( decryptCallback, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cipher: encryptedSymKey
      }),
    });
    let base64 = await response.text();
    symKeyBuffer = Buffer.from(base64, 'base64');
  }
  else {
    const privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
    symKeyBuffer = cryptoUtils.privateDecrypt(privateKey, encryptedSymKey);
  }
  
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
  //random
  let k = crypto.randomBytes(2047);
  let { n, e } = extractParameterFromPublicKey(data.publicKey);
  let secret = stringToBigInt(data.secret);

  let blockchainProof = powerMod(stringToBigInt(k),e,n).toBuffer().toString('base64');
  console.log(blockchainProof);
  let privateProof = (
    stringToBigInt( k.toString('base64') )
    .mul(secret.powm(data.challenge,n)
  )).mod(n).toBuffer().toString('base64');

  return [blockchainProof, privateProof];
}

function extractParameterFromPublicKey(publicKey) {
  let fileName = 'tmpNDIDFile' + Date.now();
  fs.writeFileSync(fileName,publicKey);
  let result = spawnSync('openssl',('rsa -pubin -in ' + fileName + ' -text -noout').split(' '));
  let resultStr = result.stdout.toString().split(':').join('');
  let resultNoHeader = resultStr.split('\n').splice(2);
  let modStr = resultNoHeader.splice(0,resultNoHeader.length-2).join('').split(' ').join('');
  let exponentStr = resultNoHeader[0].split(' ')[1];

  fs.unlink(fileName);
  return {
    n: stringToBigInt(Buffer.from(modStr,'hex').toString('base64')),
    e: bignum(exponentStr)
  };
}

function powerMod(base, exponent, modulus) {
  return base.powm(exponent, modulus);
}

function stringToBigInt(string) {
  return bignum.fromBuffer(Buffer.from(string,'base64'));
}

export function verifyZKProof(publicKey, 
  challenge, 
  privateProof, 
  publicProof, 
  sid,
) {
  let hashedSid = hash(sid.namespace + ':' + sid.identifier);
  let { n, e } = extractParameterFromPublicKey(publicKey);

  let tmp1 = powerMod(stringToBigInt(privateProof),e,n);
  let tmp2 = powerMod(
    stringToBigInt(hashedSid), 
    stringToBigInt(challenge),
    n,
  ); 

  let tmp3 = (tmp1.mul(tmp2)).mod(n);
  return stringToBigInt(publicProof).eq(tmp3);
}

export function setSignatureCallback(signCallbackUrl, decryptCallbackUrl) {
  signatureCallback = signCallbackUrl;
  decryptCallback = decryptCallbackUrl;
}

export function setMasterSignatureCallback(url) {
  masterSignatureCallback = url;
}

async function createSignatureByCallback(data, useMasterKey) {
  //TODO implement this properly
  //MUST be base64 format
  let response = await fetch( useMasterKey 
    ? signatureCallback
    : masterSignatureCallback
    , {
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

export async function createSignature(data, nonce = '', useMasterKey) {
  if (signatureCallback)
    return await createSignatureByCallback(JSON.stringify(data) + nonce, useMasterKey);
  let privateKey = (useMasterKey 
    ? fs.readFileSync(config.masterPrivateKeyPath, 'utf8')
    : fs.readFileSync(config.privateKeyPath, 'utf8')
  );
  return cryptoUtils.createSignature(data, nonce, privateKey);
}

export function createRequestId() {
  return randomHexBytes(32);
}