import crypto from 'crypto';

export async function hash(stringToHash) {
  const hash = crypto.createHash('sha256');
  hash.update(stringToHash);
  const hashStrHex = hash.digest('hex');
  return hashStrHex;
}

export async function privateDecrypt(privateKey, ciphertext) {
  const buffer = new Buffer(ciphertext, 'base64');
  const decrypted = crypto.privateDecrypt(privateKey, buffer);
  return decrypted.toString('utf8');
}

export async function privateEncrypt(privateKey, plaintext) {
  const buffer = new Buffer(plaintext);
  const encrypted = crypto.privateEncrypt(privateKey, buffer);
  return encrypted.toString('base64');
}

export async function publicDecrypt(publicKey, ciphertext) {
  const buffer = new Buffer(ciphertext, 'base64');
  const decrypted = crypto.publicDecrypt(publicKey, buffer);
  return decrypted.toString('utf8');
}

export async function publicEncrypt(publicKey, plaintext) {
  const buffer = new Buffer(plaintext);
  const encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted.toString('base64');
}

export function generateIdentityProof(data) {
  // TODO:
  return '<some-voodoo-happen-here>';
}
