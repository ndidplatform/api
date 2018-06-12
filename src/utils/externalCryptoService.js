import fs from 'fs';
import path from 'path';

import fetch from 'node-fetch';
import logger from '../logger';

import * as config from '../config';

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

export function isCallbackUrlsSet() {
  return (
    callbackUrl.signature != null &&
    callbackUrl.masterSignature != null &&
    callbackUrl.decrypt != null
  );
}

export function setDpkiCallback(signCallbackUrl, decryptCallbackUrl) {
  // TODO: Test sign/decrypt before accepting callback URL

  if (signCallbackUrl) {
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

export function setMasterSignatureCallback(url) {
  // TODO: Test sign before accepting callback URL

  if (url) {
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
