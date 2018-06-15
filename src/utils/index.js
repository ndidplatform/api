import fs from 'fs';
import crypto from 'crypto';

import * as cryptoUtils from './crypto';
import * as config from '../config';
import bignum from 'bignum';
import { parseKey } from './asn1parser';
import logger from '../logger';
import constants from 'constants';
import * as externalCryptoService from './externalCryptoService';

//let nonce = Date.now() % 10000;
const saltByteLength = 8;
const saltStringLength = saltByteLength*2;

export function wait(ms, stoppable) {
  let setTimeoutFn;
  const promise = new Promise((resolve) => setTimeoutFn = setTimeout(resolve, ms));
  if (stoppable) {
    return {
      promise,
      stopWaiting: () => clearTimeout(setTimeoutFn),
    };
  }
  return promise;
}

export function randomBase64Bytes(length) {
  return cryptoUtils.randomBase64Bytes(length);
}

export function getNonce() {
  return randomBase64Bytes(32);
}

export function hash(stringToHash) {
  return cryptoUtils.hash(stringToHash);
}

export function hashWithRandomSalt(stringToHash) {
  let saltByte = crypto.randomBytes(saltByteLength);
  let saltString = saltByte.toString('base64');
  return saltString + hash(saltString + stringToHash);
}

export function compareSaltedHash({saltedHash, plain}) {
  let saltString = saltedHash.substring(0,saltStringLength);
  return saltedHash === saltString + hash(saltString + plain);
}

export async function decryptAsymetricKey(cipher) {
  const [encryptedSymKey, encryptedMessage] = cipher.split('|');
  let symKeyBuffer;

  if (config.useExternalCryptoService) {
    symKeyBuffer = await externalCryptoService.decryptAsymetricKey(encryptedSymKey);
  } else {
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

export function extractPaddingFromPrivateEncrypt(cipher, publicKey) {
  const rawMessageBuffer = cryptoUtils.publicDecrypt({
    key: publicKey,
    padding: constants.RSA_NO_PADDING,
  }, Buffer.from(cipher,'base64'));

  //RSA PKCS v. 1.5
  if( rawMessageBuffer[0] !== 0 ||
      ( rawMessageBuffer[1] !== 0 &&
      rawMessageBuffer[1] !== 1)
    ) throw 'Invalid cipher';
  let padLength = 2;
  while(rawMessageBuffer[padLength] !== 0) padLength++;

  logger.debug({
    message: 'padding extracted',
    publicKey,
    rawMessageBuffer,
    rawMessageString: rawMessageBuffer.toString('base64'),
    hash_id_string: rawMessageBuffer.slice(padLength).toString('base64'),
    padLength,
  });

  return rawMessageBuffer.slice(0,padLength + 1).toString('base64');
}

export function generateIdentityProof(data) {
  logger.debug({
    message: 'Generating proof',
    data,
  });

  let [ padding, signedHash ] = data.secret.split('|');
  let { n, e } = extractParameterFromPublicKey(data.publicKey);
  // -1 to garantee k < n
  let k = randomBase64Bytes(n.toBuffer().length - 1);
  let kInt = stringToBigInt(k);
  let signedHashInt = stringToBigInt(signedHash);
  let challenge = stringToBigInt(data.challenge);

  let blockchainProof = powerMod(kInt,e,n).toBuffer().toString('base64');
  //console.log(blockchainProof);
  let privateProof = kInt.mul( 
    powerMod(signedHashInt,challenge,n) 
  ).mod(n).toBuffer().toString('base64');

  logger.debug({
    message: 'Proof generated',
    k: stringToBigInt(k),
    bcInt: stringToBigInt(blockchainProof),
    pvInt: stringToBigInt(privateProof),
    n,e,
    signedHashInt,
    challenge: stringToBigInt(data.challenge),
    padding,
  });

  return { 
    blockchainProof,
    privateProofValue: privateProof,
    padding: data.secret.split('|')[0],
  };
}

function extractParameterFromPublicKey(publicKey) {
  const parsedKey = parseKey(publicKey);
  return {
    n: stringToBigInt(parsedKey.modulus.toBuffer().toString('base64')),
    e: bignum(parsedKey.publicExponent.toString(10))
  };
}

function powerMod(base, exponent, modulus) {
  return base.powm(exponent, modulus);
}

function stringToBigInt(string) {
  return bignum.fromBuffer(Buffer.from(string,'base64'));
}

function euclideanGCD(a, b) {
  if( a.eq(bignum('0')) ) return [b, bignum('0'), bignum('1')];
  let [g, y, x] = euclideanGCD(b.mod(a),a);
  return [
    g, 
    x.sub(
      b.sub(
        b.mod(a)
      )
      .div(a)
      .mul(y)
    ),
    y
  ];
}

function moduloMultiplicativeInverse(a, modulo) {
  let [g, x, y] = euclideanGCD(a, modulo);
  if(!g.eq(1)) throw 'No modular inverse';
  return x.mod(modulo);
}

export function verifyZKProof(publicKey, 
  challenge, 
  privateProof, 
  publicProof, 
  sid,
  privateProofHash,
  padding,
) {
  if(privateProofHash !== hash(privateProof)) return false;

  let { n, e } = extractParameterFromPublicKey(publicKey);
  let hashedSid = hash(sid.namespace + ':' + sid.identifier);

  let paddedHashedSid = Buffer.concat([
    Buffer.from(padding,'base64'),
    Buffer.from(hashedSid,'base64')
  ]).toString('base64');

  let inverseHashSid = moduloMultiplicativeInverse(stringToBigInt(paddedHashedSid), n);
  if(inverseHashSid.lt(bignum(0))) inverseHashSid = inverseHashSid.add(n);

  let tmp1 = powerMod(stringToBigInt(privateProof),e,n);
  let tmp2 = powerMod(
    inverseHashSid, 
    stringToBigInt(challenge),
    n,
  ); 

  let tmp3 = (tmp1.mul(tmp2)).mod(n);

  logger.debug({
    message: 'ZK Verify result',
    hashBigInt: stringToBigInt(hashedSid),
    inverseHashSid,
    n,e,
    tmp1,
    tmp2,
    tmp3,
    publicProofBigInt: stringToBigInt(publicProof),
    publicProof,
    paddedHashedSid: stringToBigInt(paddedHashedSid),
    hashedSid,
  });

  return stringToBigInt(publicProof).eq(tmp3);
}

export async function createSignature(data, nonce = '', useMasterKey) {
  const messageToSign = JSON.stringify(data) + nonce;
  const messageToSignHash = hash(messageToSign);
  
  if (config.useExternalCryptoService) {
    return await externalCryptoService.createSignature(
      messageToSign,
      messageToSignHash,
      useMasterKey
    );
  }

  const privateKey = useMasterKey
    ? fs.readFileSync(config.masterPrivateKeyPath, 'utf8')
    : fs.readFileSync(config.privateKeyPath, 'utf8');

  return cryptoUtils.createSignature(messageToSign, privateKey);
}

export function verifySignature(signatureInBase64, publicKey, plainText) {
  return cryptoUtils.verifySignature(signatureInBase64, publicKey, plainText);
}

export function createRequestId() {
  return cryptoUtils.randomHexBytes(32);
}

/**
 * @typedef {Object} RequestStatus
 * @property {string} request_id 
 * @property {string} status 
 * @property {number} min_idp 
 * @property {number} answered_idp_count 
 * @property {boolean} closed 
 * @property {boolean} timed_out 
 * @property {Object} service_list 
 * @property {string} service_list.service_id 
 * @property {number} service_list.count 
 * @property {number} service_list.signed_data_count 
 * @property {number} service_list.received_data_count 
 */
/**
 * 
 * @param {Object} requestDetail 
 * @param {string} requestDetail.request_id 
 * @param {number} requestDetail.min_idp
 * @param {number} requestDetail.min_ial
 * @param {number} requestDetail.min_aal
 * @param {number} requestDetail.request_timeout
 * @param {Array.<Object>} requestDetail.data_request_list
 * @param {string} requestDetail.request_message_hash
 * @param {Array.<Object>} requestDetail.responses
 * @param {boolean} requestDetail.closed
 * @param {boolean} requestDetail.timed_out
 * @returns {RequestStatus} requestStatus
 */
export function getDetailedRequestStatus(requestDetail) {
  if (requestDetail.responses == null) {
    requestDetail.responses = [];
  }

  let status;
  if (requestDetail.responses.length === 0) {
    status = 'pending';
  }
  // Check response's status
  const responseCount = requestDetail.responses.reduce(
    (count, response) => {
      if (response.status === 'accept') {
        count.accept++;
      } else if (response.status === 'reject') {
        count.reject++;
      }
      return count;
    },
    {
      accept: 0,
      reject: 0,
    }
  );
  if (responseCount.accept > 0 && responseCount.reject === 0) {
    status = 'confirmed';
  } else if (responseCount.accept === 0 && responseCount.reject > 0) {
    status = 'rejected';
  } else if (responseCount.accept > 0 && responseCount.reject > 0) {
    status = 'complicated';
  }

  const serviceList = requestDetail.data_request_list.map((service) => {
    const signedAnswerCount =
      service.answered_as_id_list != null
        ? service.answered_as_id_list.length
        : 0;
    const receivedDataCount = 
      service.received_data_from_list != null
        ? service.received_data_from_list.length
        : 0;
    return {
      service_id: service.service_id,
      count: service.count,
      signed_data_count: signedAnswerCount,
      received_data_count: receivedDataCount,
    };
  });

  if (requestDetail.data_request_list.length === 0) {
    // No data request
    if (requestDetail.responses.length === requestDetail.min_idp) {
      if (responseCount.accept > 0 && responseCount.reject === 0) {
        status = 'completed';
      }
    }
  } else if (requestDetail.data_request_list.length > 0) {
    const asSignedAnswerCount = serviceList.reduce(
      (total, service) => ({
        count: total.count + service.count,
        signedAnswerCount: total.signedAnswerCount + service.signed_data_count,
        receivedDataCount:
          total.receivedDataCount + service.received_data_count,
      }),
      {
        count: 0,
        signedAnswerCount: 0,
        receivedDataCount: 0,
      }
    );

    if (
      asSignedAnswerCount.count === asSignedAnswerCount.signedAnswerCount &&
      asSignedAnswerCount.signedAnswerCount ===
        asSignedAnswerCount.receivedDataCount
    ) {
      status = 'completed';
    }
  }
  return {
    request_id: requestDetail.request_id,
    status,
    min_idp: requestDetail.min_idp,
    answered_idp_count: requestDetail.responses.length,
    closed: requestDetail.closed,
    timed_out: requestDetail.timed_out,
    service_list: serviceList,
  };
}