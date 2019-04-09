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

import crypto from 'crypto';

const PBKDF2_ITERATIONS = 10000;
const AES_KEY_LENGTH_IN_BYTES = 32;

/**
 * Hash given string with SHA-256
 * 
 * @param {string|Buffer} dataToHash
 * 
 * @returns {Buffer} hash in Buffer
 */
export function sha256(dataToHash) {
  const hash = crypto.createHash('sha256');
  hash.update(dataToHash);
  const hashBuffer = hash.digest();
  return hashBuffer;
}

/**
 *
 * @param {({key: string, passphrase: string}|string)} privateKey
 * @param {(Buffer|string)} plaintext
 * 
 * @returns {Buffer} encrypted text
 */
export function privateEncrypt(privateKey, plaintext) {
  const buffer = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext, 'utf8');
  const encrypted = crypto.privateEncrypt(privateKey, buffer);
  return encrypted;
}

/**
 *
 * @param {({key: string, passphrase: string}|string)} privateKey
 * @param {(Buffer|string)} ciphertext
 * 
 * @returns {Buffer} decrypted text
 */
export function privateDecrypt(privateKey, ciphertext) {
  const buffer = Buffer.isBuffer(ciphertext)
    ? ciphertext
    : Buffer.from(ciphertext, 'utf8');
  const decrypted = crypto.privateDecrypt(privateKey, buffer);
  return decrypted;
}

/**
 *
 * @param {(Object|string)} publicKey
 * @param {(Buffer|string)} plaintext
 * 
 * @returns {Buffer} ciphertext
 */
export function publicEncrypt(publicKey, plaintext) {
  const buffer = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext, 'utf8');
  const encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted;
}

/**
 *
 * @param {(Object|string)} publicKey
 * @param {(Buffer|string)} ciphertext base64 encoded ciphertext
 * 
 * @returns {Buffer} decrypted text
 */
export function publicDecrypt(publicKey, ciphertext) {
  const buffer = Buffer.isBuffer(ciphertext)
    ? ciphertext
    : Buffer.from(ciphertext, 'utf8');
  const decrypted = crypto.publicDecrypt(publicKey, buffer);
  return decrypted;
}

/**
 *
 * @param {string|Buffer} message
 * @param {({key: string, passphrase: string}|string)} privateKey
 * 
 * @returns {Buffer} signature
 */
export function createSignature(message, privateKey) {
  return crypto
    .createSign('SHA256')
    .update(message)
    .sign(privateKey);
}

/**
 * 
 * @param {Buffer} signature
 * @param {(string|Object)} publicKey 
 * @param {string|Buffer} dataToVerify 
 * 
 * @returns {boolean}
 */
export function verifySignature(signature, publicKey, dataToVerify) {
  return crypto
    .createVerify('SHA256')
    .update(dataToVerify)
    .verify(publicKey, signature);
}

/**
 *
 * @param {number} length random bytes length
 * 
 * @returns {string} hex string of random bytes
 */
export function randomHexBytes(length) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 
 * @param {number} length random bytes length
 * 
 * @returns {string} base64 encoded string of random bytes
 */
export function randomBase64Bytes(length) {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Encrypt plaintext using given key with AES-256-GCM
 * 
 * @param {(Buffer|string)} masterkey
 * @param {Buffer} plaintext
 * @param {boolean} deriveKey derive masterkey using pbkdf2
 * 
 * @returns {Buffer} encrypted text
 */
export function encryptAES256GCM(masterkey, plaintext, deriveKey) {
  // random initialization vector
  const iv = crypto.randomBytes(16);

  let salt;

  // derive key: 32 byte key length - in assumption the masterkey is a cryptographic and NOT a password there is no need for
  // a large number of iterations. It may can replaced by HKDF
  let key;
  if (deriveKey) {
    // random salt
    salt = crypto.randomBytes(64);
    key = crypto.pbkdf2Sync(
      masterkey,
      salt,
      PBKDF2_ITERATIONS,
      AES_KEY_LENGTH_IN_BYTES,
      'sha512'
    );
  } else {
    salt = Buffer.alloc(64);
    key = masterkey;
  }

  // AES 256 GCM Mode
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // encrypt the given plaintext
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  // extract the auth tag
  const tag = cipher.getAuthTag();

  // generate output
  return Buffer.concat([salt, iv, tag, encrypted]);
}

/**
 * Decrypt ciphertext using given key with AES-256-GCM
 * 
 * @param {(Buffer|string)} masterkey
 * @param {Buffer} ciphertext input data
 * @param {boolean} deriveKey derive masterkey using pbkdf2
 * 
 * @returns {Buffer} decrypted (original) text
 */
export function decryptAES256GCM(masterkey, ciphertext, deriveKey) {
  // convert data to buffers
  const salt = ciphertext.slice(0, 64);
  const iv = ciphertext.slice(64, 80);
  const tag = ciphertext.slice(80, 96);
  const text = ciphertext.slice(96);

  // derive key: 32 byte key length
  let key;
  if (deriveKey) {
    key = crypto.pbkdf2Sync(
      masterkey,
      salt,
      PBKDF2_ITERATIONS,
      AES_KEY_LENGTH_IN_BYTES,
      'sha512'
    );
  } else {
    key = masterkey;
  }

  // AES 256 GCM Mode
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  // decrypt the ciphertext
  const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);

  return decrypted;
}
