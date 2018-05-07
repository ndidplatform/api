import crypto from 'crypto';

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

export function privateEncrypt(privateKey, plaintext) {
  const buffer = Buffer.from(plaintext, 'utf8');
  const encrypted = crypto.privateEncrypt(privateKey, buffer);
  return encrypted.toString('base64');
}

export function privateDecrypt(privateKey, ciphertext) {
  const buffer = Buffer.from(ciphertext, 'base64');
  const decrypted = crypto.privateDecrypt(privateKey, buffer);
  return decrypted.toString('utf8');
}

export function publicEncrypt(publicKey, plaintext) {
  const buffer = Buffer.from(plaintext, 'utf8');
  const encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted.toString('base64');
}

export function publicDecrypt(publicKey, ciphertext) {
  const buffer = Buffer.from(ciphertext, 'base64');
  const decrypted = crypto.publicDecrypt(publicKey, buffer);
  return decrypted.toString('utf8');
}

/**
 * Encrypt plaintext using given key with AES-256-GCM
 * @param {Buffer} masterkey
 * @param {string} plaintext
 * @returns {(string|null)} encrypted text, base64 encoded or null if error
 */
export function encryptAES256GCM(masterkey, plaintext) {
  try {
    // random initialization vector
    const iv = crypto.randomBytes(16);

    // random salt
    const salt = crypto.randomBytes(64);

    // derive key: 32 byte key length - in assumption the masterkey is a cryptographic and NOT a password there is no need for
    // a large number of iterations. It may can replaced by HKDF
    const key = crypto.pbkdf2Sync(masterkey, salt, 2145, 32, 'sha512');

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
    throw null;
  }
}

/**
 * Decrypt ciphertext using given key with AES-256-GCM
 * @param {Buffer} masterkey
 * @param {string} base64 encoded input data
 * @returns {(string|null)} decrypted (original) text or null if error
 */
export function decryptAES256GCM(masterkey, ciphertext) {
  try {
    // base64 decoding
    const bData = Buffer.from(ciphertext, 'base64');

    // convert data to buffers
    const salt = bData.slice(0, 64);
    const iv = bData.slice(64, 80);
    const tag = bData.slice(80, 96);
    const text = bData.slice(96);

    // derive key: 32 byte key length
    const key = crypto.pbkdf2Sync(masterkey, salt, 2145, 32, 'sha512');

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
  return '<some-voodoo-happen-here>';
}
