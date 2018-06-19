import fs from 'fs';
import path from 'path';

import fetch from 'node-fetch';

import { hash, publicEncrypt, verifySignature } from './crypto';
import * as tendermint from '../tendermint/ndid';
import CustomError from '../error/customError';
import errorType from '../error/type';
import logger from '../logger';

import * as config from '../config';

const TEST_MESSAGE = 'test';
const TEST_MESSAGE_BASE_64 = Buffer.from(TEST_MESSAGE).toString('base64');

const callbackUrl = {};

const callbackUrlFilesPrefix = path.join(
  __dirname,
  '..',
  '..',
  'dpki-callback-url-' + config.nodeId
);

['signature', 'masterSignature', 'decrypt'].forEach((key) => {
  try {
    callbackUrl[key] = fs.readFileSync(
      callbackUrlFilesPrefix + '-' + key,
      'utf8'
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn({
        message: 'DPKI ' + key + ' callback url file not found',
      });
    } else {
      logger.error({
        message: 'Cannot read DPKI ' + key + ' callback url file(s)',
        error,
      });
    }
  }
});

// FIXME: Refactor
async function getNodePubKey(node_id) {
  try {
    return await tendermint.query('GetNodePublicKey', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node public key from blockchain',
      cause: error,
    });
  }
}

async function getNodeMasterPubKey(node_id) {
  try {
    return await tendermint.query('GetNodeMasterPublicKey', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node master public key from blockchain',
      cause: error,
    });
  }
}

async function testSignCallback(url, publicKey) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      node_id: config.nodeId,
      request_message: TEST_MESSAGE,
      request_message_hash: hash(TEST_MESSAGE),
      hash_method: 'SHA256',
      key_type: 'RSA',
      sign_method: 'RSA-SHA256',
    }),
  });
  const { signature } = await response.json();
  if (!verifySignature(signature, publicKey, TEST_MESSAGE)) {
    throw new CustomError({
      message: 'Invalid signature',
    });
  }
}

async function testDecryptCallback(url, publicKey) {
  const encryptedMessage = publicEncrypt(publicKey, TEST_MESSAGE);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      node_id: config.nodeId,
      encrypted_message: encryptedMessage,
      key_type: 'RSA',
    }),
  });
  const decryptedMessageBase64 = (await response.json()).decrypted_message;
  if (TEST_MESSAGE_BASE_64 !== decryptedMessageBase64) {
    throw new CustomError({
      message: 'Decrypted message mismatch',
    });
  }
}

export function getCallbackUrls() {
  return {
    signature: callbackUrl.signature,
    decrypt: callbackUrl.decrypt,
    master_signature: callback.masterSignature,
  }
}

export function isCallbackUrlsSet() {
  return (
    callbackUrl.signature != null &&
    callbackUrl.masterSignature != null &&
    callbackUrl.decrypt != null
  );
}

export async function setDpkiCallback(signCallbackUrl, decryptCallbackUrl) {
  let public_key;

  if (signCallbackUrl) {
    try {
      if (public_key == null) {
        public_key = (await getNodePubKey(config.nodeId)).public_key;
      }
      await testSignCallback(signCallbackUrl, public_key);
    } catch (error) {
      throw new CustomError({
        message: errorType.EXTERNAL_SIGN_TEST_FAILED.message,
        code: errorType.EXTERNAL_SIGN_TEST_FAILED.code,
        cause: error,
      });
    }

    callbackUrl.signature = signCallbackUrl;
    fs.writeFile(
      callbackUrlFilesPrefix + '-signature',
      signCallbackUrl,
      (err) => {
        if (err) {
          logger.error({
            message: 'Cannot write DPKI sign callback url file',
            error: err,
          });
        }
      }
    );
  }
  if (decryptCallbackUrl) {
    try {
      if (public_key == null) {
        public_key = (await getNodePubKey(config.nodeId)).public_key;
      }
      await testDecryptCallback(decryptCallbackUrl, public_key);
    } catch (error) {
      throw new CustomError({
        message: errorType.EXTERNAL_DECRYPT_TEST_FAILED.message,
        code: errorType.EXTERNAL_DECRYPT_TEST_FAILED.code,
        cause: error,
      });
    }

    callbackUrl.decrypt = decryptCallbackUrl;
    fs.writeFile(
      callbackUrlFilesPrefix + '-decrypt',
      decryptCallbackUrl,
      (err) => {
        if (err) {
          logger.error({
            message: 'Cannot write DPKI sign callback url file',
            error: err,
          });
        }
      }
    );
  }
}

export async function setMasterSignatureCallback(url) {
  if (url) {
    try {
      const { master_public_key } = await getNodeMasterPubKey(config.nodeId);
      await testSignCallback(url, master_public_key);
    } catch (error) {
      throw new CustomError({
        message: errorType.EXTERNAL_SIGN_MASTER_TEST_FAILED.message,
        code: errorType.EXTERNAL_SIGN_MASTER_TEST_FAILED.code,
        cause: error,
      });
    }

    callbackUrl.masterSignature = url;
    fs.writeFile(callbackUrlFilesPrefix + '-masterSignature', url, (err) => {
      if (err) {
        logger.error({
          message: 'Cannot write DPKI master-sign callback url file',
          error: err,
        });
      }
    });
  }
}

export async function decryptAsymetricKey(encryptedMessage) {
  if (callbackUrl.decrypt == null) {
    throw new CustomError({
      message: errorType.EXTERNAL_DECRYPT_URL_NOT_SET.message,
      code: errorType.EXTERNAL_DECRYPT_URL_NOT_SET.code,
    });
  }
  try {
    const response = await fetch(callbackUrl.decrypt, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        node_id: config.nodeId,
        encrypted_message: encryptedMessage,
        key_type: 'RSA',
      }),
    });
    const decryptedMessageBase64 = (await response.json()).decrypted_message;
    return Buffer.from(decryptedMessageBase64, 'base64');
  } catch (error) {
    // TODO: retry
    logger.error({
      message: 'Error calling external crypto service: decrypt',
      callbackUrl: callbackUrl.decrypt,
    });
    throw error;
  }
}

export async function createSignature(message, messageHash, useMasterKey) {
  const url = useMasterKey
    ? callbackUrl.masterSignature
    : callbackUrl.signature;
  if (url == null) {
    if (useMasterKey) {
      throw new CustomError({
        message: errorType.EXTERNAL_SIGN_MASTER_URL_NOT_SET.message,
        code: errorType.EXTERNAL_SIGN_MASTER_URL_NOT_SET.code,
      });
    } else {
      throw new CustomError({
        message: errorType.EXTERNAL_SIGN_URL_NOT_SET.message,
        code: errorType.EXTERNAL_SIGN_URL_NOT_SET.code,
      });
    }
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        node_id: config.nodeId,
        request_message: message,
        request_message_hash: messageHash,
        hash_method: 'SHA256',
        key_type: 'RSA',
        sign_method: 'RSA-SHA256',
      }),
    });
    return (await response.json()).signature;
  } catch (error) {
    // TODO: retry
    logger.error({
      message: 'Error calling external crypto service: sign',
      callbackUrl: url,
    });
    throw error;
  }
}
