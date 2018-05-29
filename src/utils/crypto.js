import crypto from 'crypto';

const PBKDF2_ITERATIONS = 10000;
const AES_KEY_LENGTH_IN_BYTES = 32;

/**
 * Hash given string with SHA-256
 * @param {string} stringToHash
 * @returns {string} hash
 */
export function hash(stringToHash) {
  const hash = crypto.createHash('sha256');
  hash.update(stringToHash);
  const hashStrHex = hash.digest('hex');
  return hashStrHex;
}

/**
 * 
 * @param {(Object|string)} privateKey 
 * @param {(Buffer|string)} plaintext 
 * @returns {string} encrypted text, base64 encoded
 */
export function privateEncrypt(privateKey, plaintext) {
  const buffer = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext, 'utf8');
  const encrypted = crypto.privateEncrypt(privateKey, buffer);
  return encrypted.toString('base64');
}

/**
 * 
 * @param {(Object|string)} privateKey 
 * @param {string} ciphertext base64 encoded ciphertext
 * @returns {Buffer} decrypted text
 */
export function privateDecrypt(privateKey, ciphertext) {
  const buffer = Buffer.from(ciphertext, 'base64');
  const decrypted = crypto.privateDecrypt(privateKey, buffer);
  return decrypted;
}

/**
 * 
 * @param {(Object|string)} publicKey 
 * @param {(Buffer|string)} plaintext 
 * @returns {string} encrypted text, base64 encoded
 */
export function publicEncrypt(publicKey, plaintext) {
  const buffer = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext, 'utf8');
  const encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted.toString('base64');
}

/**
 * 
 * @param {(Object|string)} publicKey 
 * @param {string} ciphertext base64 encoded ciphertext
 * @returns {Buffer} decrypted text
 */
export function publicDecrypt(publicKey, ciphertext) {
  const buffer = Buffer.from(ciphertext, 'base64');
  const decrypted = crypto.publicDecrypt(publicKey, buffer);
  return decrypted;
}

export function createSignature(data, nonce, privateKey) {
  return crypto
    .createSign('SHA256')
    .update(JSON.stringify(data) + nonce)
    .sign(privateKey, 'base64');
}

/**
 * 
 * @param {number} length random bytes length
 * @returns {string} hex string of random bytes
 */
export function randomHexBytes(length) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Encrypt plaintext using given key with AES-256-GCM
 * @param {(Buffer|string)} masterkey
 * @param {string} plaintext
 * @param {boolean} deriveKey derive masterkey using pbkdf2
 * @returns {(string|null)} encrypted text, base64 encoded or null if error
 */
export function encryptAES256GCM(masterkey, plaintext, deriveKey) {
  try {
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
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // extract the auth tag
    const tag = cipher.getAuthTag();

    // generate output
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  } catch (error) {
    return null;
  }
}

/**
 * Decrypt ciphertext using given key with AES-256-GCM
 * @param {(Buffer|string)} masterkey
 * @param {string} base64 encoded input data
 * @param {boolean} deriveKey derive masterkey using pbkdf2
 * @returns {(string|null)} decrypted (original) text or null if error
 */
export function decryptAES256GCM(masterkey, ciphertext, deriveKey) {
  try {
    // base64 decoding
    const bData = Buffer.from(ciphertext, 'base64');

    // convert data to buffers
    const salt = bData.slice(0, 64);
    const iv = bData.slice(64, 80);
    const tag = bData.slice(80, 96);
    const text = bData.slice(96);

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
    const decrypted =
      decipher.update(text, 'binary', 'utf8') + decipher.final('utf8');

    return decrypted;
  } catch (error) {
    return null;
  }
}

export function generateIdentityProof(data) {
  // TODO:
  //[blockchain-proof, private-proof]
  return ['<some-voodoo-happen-here>','<another-voodoo-happen-here>'];
}
