/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 *
 * This file is part of NDID software.
 *
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 *
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 *
 * Please contact info@ndid.co.th for any further questions
 *
 */

// Adapted from https://github.com/crypto-browserify/parse-asn1

import crypto from 'crypto';

import * as structure from './structure';

// Support only AES for encrypted private key
const findProc = /Proc-Type: 4,ENCRYPTED[\n\r]+DEK-Info: AES-((?:128)|(?:192)|(?:256))-CBC,([0-9A-H]+)[\n\r]+([0-9A-z\n\r+/=]+)[\n\r]+/m;
const startRegex = /^-----BEGIN ((?:.* KEY)|CERTIFICATE)-----/m;
const fullRegex = /^-----BEGIN ((?:.* KEY)|CERTIFICATE)-----([0-9A-z\n\r+/=]+)-----END \1-----$/m;

const AES_ID = {
  '2.16.840.1.101.3.4.1.1': 'aes-128-ecb',
  '2.16.840.1.101.3.4.1.2': 'aes-128-cbc',
  '2.16.840.1.101.3.4.1.3': 'aes-128-ofb',
  '2.16.840.1.101.3.4.1.4': 'aes-128-cfb',
  '2.16.840.1.101.3.4.1.21': 'aes-192-ecb',
  '2.16.840.1.101.3.4.1.22': 'aes-192-cbc',
  '2.16.840.1.101.3.4.1.23': 'aes-192-ofb',
  '2.16.840.1.101.3.4.1.24': 'aes-192-cfb',
  '2.16.840.1.101.3.4.1.41': 'aes-256-ecb',
  '2.16.840.1.101.3.4.1.42': 'aes-256-cbc',
  '2.16.840.1.101.3.4.1.43': 'aes-256-ofb',
  '2.16.840.1.101.3.4.1.44': 'aes-256-cfb',
};

function extractKey(key, passphrase) {
  const match = key.match(findProc);
  let decrypted;
  if (!match) {
    const match2 = key.match(fullRegex);
    decrypted = Buffer.from(match2[2].replace(/[\r\n]/g, ''), 'base64');
  } else {
    // Key with passphase
    const suite = 'aes' + match[1];
    const iv = Buffer.from(match[2], 'hex');
    const cipherText = Buffer.from(match[3].replace(/[\r\n]/g, ''), 'base64');
    const cipherKey = EVP_BytesToKey(
      passphrase,
      iv.slice(0, 8),
      parseInt(match[1], 10)
    ).key;
    const decipher = crypto.createDecipheriv(suite, cipherKey, iv);
    decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  }
  const tag = key.match(startRegex)[1];
  return {
    tag: tag,
    data: decrypted,
  };
}

// Adapted from https://github.com/crypto-browserify/EVP_BytesToKey
function EVP_BytesToKey(password, salt, keyBits, ivLen) {
  if (!Buffer.isBuffer(password)) password = Buffer.from(password, 'binary');
  if (salt) {
    if (!Buffer.isBuffer(salt)) salt = Buffer.from(salt, 'binary');
    if (salt.length !== 8)
      throw new RangeError('salt should be Buffer with 8 byte length');
  }

  let keyLen = keyBits / 8;
  const key = Buffer.alloc(keyLen);
  const iv = Buffer.alloc(ivLen || 0);
  let tmp = Buffer.alloc(0);

  while (keyLen > 0 || ivLen > 0) {
    const hash = crypto.createHash('md5');
    hash.update(tmp);
    hash.update(password);
    if (salt) hash.update(salt);
    tmp = hash.digest();

    let used = 0;

    if (keyLen > 0) {
      const keyStart = key.length - keyLen;
      used = Math.min(keyLen, tmp.length);
      tmp.copy(key, keyStart, 0, used);
      keyLen -= used;
    }

    if (used < tmp.length && ivLen > 0) {
      const ivStart = iv.length - ivLen;
      const length = Math.min(ivLen, tmp.length - used);
      tmp.copy(iv, ivStart, used, used + length);
      ivLen -= length;
    }
  }

  tmp.fill(0);
  return { key: key, iv: iv };
}

function decryptPrivateKey(data, password) {
  const salt = data.algorithm.decrypt.kde.kdeparams.salt;
  const iters = parseInt(
    data.algorithm.decrypt.kde.kdeparams.iters.toString(),
    10
  );
  const algo = AES_ID[data.algorithm.decrypt.cipher.algo.join('.')];
  const iv = data.algorithm.decrypt.cipher.iv;
  const cipherText = data.subjectPrivateKey;
  const keylen = parseInt(algo.split('-')[1], 10) / 8;
  const key = crypto.pbkdf2Sync(password, salt, iters, keylen);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return decrypted;
}

export function parseKey(key) {
  if (key == null) {
    throw new Error('Invalid param');
  }
  let passphrase;
  if (typeof key === 'object' && !Buffer.isBuffer(key)) {
    passphrase = key.passphrase;
    key = key.key;
  }
  if (Buffer.isBuffer(key)) {
    key = key.toString();
  }

  let { tag: type, data } = extractKey(key, passphrase);

  let subtype, ndata;
  switch (type) {
    case 'PUBLIC KEY':
      if (!ndata) {
        ndata = structure.PublicKey.decode(data, 'der');
      }
      subtype = ndata.algorithm.algorithm.join('.');
      switch (subtype) {
        case '1.2.840.113549.1.1.1':
          return {
            type: 'rsa',
            data: structure.RSAPublicKey.decode(
              ndata.subjectPublicKey.data,
              'der'
            ),
          };
        case '1.2.840.10045.2.1':
          ndata.subjectPrivateKey = ndata.subjectPublicKey;
          return {
            type: 'ec',
            data: ndata,
          };
        case '1.2.840.10040.4.1':
          ndata.algorithm.params.pub_key = structure.DSAparam.decode(
            ndata.subjectPublicKey.data,
            'der'
          );
          return {
            type: 'dsa',
            data: ndata.algorithm.params,
          };
        default:
          throw new Error('Unknown OID: ' + subtype);
      }
    case 'ENCRYPTED PRIVATE KEY':
      data = structure.EncryptedPrivateKey.decode(data, 'der');
      data = decryptPrivateKey(data, passphrase);
      /* fallthrough */
    case 'PRIVATE KEY':
      ndata = structure.PrivateKey.decode(data, 'der');
      subtype = ndata.algorithm.algorithm.join('.');
      switch (subtype) {
        case '1.2.840.113549.1.1.1':
          return {
            type: 'rsa',
            privateKey: structure.RSAPrivateKey.decode(
              ndata.subjectPrivateKey,
              'der'
            ),
          };
        case '1.2.840.10045.2.1':
          return {
            type: 'ec',
            curve: ndata.algorithm.curve,
            privateKey: structure.ECPrivateKey.decode(
              ndata.subjectPrivateKey,
              'der'
            ).privateKey,
          };
        case '1.2.840.10040.4.1':
          ndata.algorithm.params.priv_key = structure.DSAparam.decode(
            ndata.subjectPrivateKey,
            'der'
          );
          return {
            type: 'dsa',
            params: ndata.algorithm.params,
          };
        default:
          throw new Error('Unknown OID: ' + subtype);
      }
    case 'RSA PUBLIC KEY':
      return {
        type: 'rsa',
        data: structure.RSAPublicKey.decode(data, 'der'),
      };
    case 'RSA PRIVATE KEY':
      return {
        type: 'rsa',
        privateKey: structure.RSAPrivateKey.decode(data, 'der'),
      };
    case 'DSA PRIVATE KEY':
      return {
        type: 'dsa',
        params: structure.DSAPrivateKey.decode(data, 'der'),
      };
    case 'EC PRIVATE KEY':
      data = structure.ECPrivateKey.decode(data, 'der');
      return {
        type: 'ec',
        curve: data.parameters.value,
        privateKey: data.privateKey,
      };
    default:
      throw new Error('Unknown key type: ' + type);
  }
}

export function parseSignature(decryptedSignature) {
  return structure.Signature.decode(decryptedSignature, 'der');
}

export function encodeSignature(algorithm, digest) {
  return structure.Signature.encode(
    {
      algorithm: {
        algorithm,
      },
      digest,
    },
    'der'
  );
}
