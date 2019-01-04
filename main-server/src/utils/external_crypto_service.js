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

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';

import fetch from 'node-fetch';
import { ExponentialBackoff } from 'simple-backoff';

import { publicEncrypt, randomBase64Bytes } from './crypto';
import { hash, verifySignature } from '.';
import * as tendermintNdid from '../tendermint/ndid';
import { wait } from '.';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../logger';

import * as config from '../config';
import { internalEmitter as masterEventEmitter } from '../master-worker-interface/server'; 

const TEST_MESSAGE = 'test';
const TEST_MESSAGE_BASE_64 = Buffer.from(TEST_MESSAGE).toString('base64');

const callbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  config.dataDirectoryPath,
  'dpki-callback-url-' + config.nodeId
);

const waitPromises = [];
let stopCallbackRetry = false;

let pendingCallbacksCount = 0;

export const eventEmitter = new EventEmitter();

export function changeDpkiCallbackForWorker(dpkiCallbackObject) {
  [
    { key: 'sign_url', fileSuffix: 'signature' },
    { key: 'master_sign_url', fileSuffix: 'masterSignature' },
    { key: 'decrypt_url', fileSuffix: 'decrypt' },
  ].forEach(({ key, fileSuffix }) => {
    if(dpkiCallbackObject[key]) {
      callbackUrls[key] = dpkiCallbackObject[key];
      fs.writeFile(
        callbackUrlFilesPrefix + fileSuffix,
        dpkiCallbackObject[key],
        (err) => {
          if (err) {
            logger.error({
              message: '[DPKI] Cannot write ' + fileSuffix + ' callback url file',
              error: err,
            });
          }
        }
      );
    }
  });
}

export function readCallbackUrlsFromFiles() {
  [
    { key: 'sign_url', fileSuffix: 'signature' },
    { key: 'master_sign_url', fileSuffix: 'masterSignature' },
    { key: 'decrypt_url', fileSuffix: 'decrypt' },
  ].forEach(({ key, fileSuffix }) => {
    try {
      callbackUrls[key] = fs.readFileSync(
        callbackUrlFilesPrefix + '-' + fileSuffix,
        'utf8'
      );
      logger.info({
        message: `[DPKI] ${fileSuffix} callback url read from file`,
        callbackUrl: callbackUrls[key],
      });
      masterEventEmitter.emit('dpki_callback_url_changed', {
        [key]: callbackUrls[key],
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn({
          message: `[DPKI] ${fileSuffix} callback url file not found`,
        });
      } else {
        logger.error({
          message: `[DPKI] Cannot read ${fileSuffix} callback url file`,
          error,
        });
      }
    }
  });
}

async function testSignCallback(url, publicKey, isMaster) {
  const body = {
    node_id: config.nodeId,
    request_message: TEST_MESSAGE,
    request_message_hash: hash(TEST_MESSAGE),
    hash_method: 'SHA256',
    key_type: 'RSA',
    sign_method: 'RSA-SHA256',
  };
  logger.info({
    message: 'Testing external sign with node key',
    url,
    publicKey,
    body,
  });

  let response, responseBody, signature;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    responseBody = await response.text();
    logger.info({
      message: 'Testing external sign with node key: response',
      httpStatusCode: response.status,
      body: responseBody,
    });
  } catch (error) {
    if (isMaster) {
      throw new CustomError({
        errorType:
          errorType.EXTERNAL_MASTER_SIGN_TEST_FAILED_CONNECTIVITY_ERROR,
        cause: error,
      });
    } else {
      throw new CustomError({
        errorType: errorType.EXTERNAL_SIGN_TEST_FAILED_CONNECTIVITY_ERROR,
        cause: error,
      });
    }
  }

  try {
    signature = JSON.parse(responseBody).signature;
  } catch (error) {
    if (isMaster) {
      throw new CustomError({
        errorType:
          errorType.EXTERNAL_MASTER_SIGN_TEST_FAILED_JSON_PARSING_ERROR,
      });
    } else {
      throw new CustomError({
        errorType: errorType.EXTERNAL_SIGN_TEST_FAILED_JSON_PARSING_ERROR,
      });
    }
  }

  if (!verifySignature(signature, publicKey, TEST_MESSAGE)) {
    if (isMaster) {
      throw new CustomError({
        errorType: errorType.EXTERNAL_MASTER_SIGN_TEST_FAILED_INVALID_SIGNATURE,
      });
    } else {
      throw new CustomError({
        errorType: errorType.EXTERNAL_SIGN_TEST_FAILED_INVALID_SIGNATURE,
      });
    }
  }
}

async function testDecryptCallback(url, publicKey) {
  const encryptedMessageBuffer = publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    TEST_MESSAGE
  );
  const encryptedMessage = encryptedMessageBuffer.toString('base64');
  const body = {
    node_id: config.nodeId,
    encrypted_message: encryptedMessage,
    key_type: 'RSA',
  };

  logger.info({
    message: 'Testing external decrypt with node key',
    url,
    publicKey,
    body,
  });

  let response, responseBody, decryptedMessageBase64;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    responseBody = await response.text();
    logger.info({
      message: 'Testing external decrypt with node key: response',
      httpStatusCode: response.status,
      body: responseBody,
    });
  } catch (error) {
    throw new CustomError({
      errorType: errorType.EXTERNAL_DECRYPT_TEST_FAILED_CONNECTIVITY_ERROR,
      cause: error,
    });
  }

  try {
    decryptedMessageBase64 = JSON.parse(responseBody).decrypted_message;
  } catch (error) {
    throw new CustomError({
      errorType: errorType.EXTERNAL_DECRYPT_TEST_FAILED_JSON_PARSING_ERROR,
      cause: error,
    });
  }

  if (TEST_MESSAGE_BASE_64 !== decryptedMessageBase64) {
    throw new CustomError({
      errorType: errorType.EXTERNAL_DECRYPT_TEST_FAILED_MESSAGE_MISMATCH,
    });
  }
}

export function getCallbackUrls() {
  return callbackUrls;
}

export function isCallbackUrlsSet() {
  return (
    callbackUrls.sign_url != null &&
    callbackUrls.master_sign_url != null &&
    callbackUrls.decrypt_url != null
  );
}

function checkAndEmitAllCallbacksSet() {
  if (isCallbackUrlsSet()) {
    eventEmitter.emit('allCallbacksSet');
  }
}

export async function setDpkiCallback({
  signCallbackUrl,
  masterSignCallbackUrl,
  decryptCallbackUrl,
}) {
  let public_key;

  if (signCallbackUrl) {
    if (public_key == null) {
      public_key = await tendermintNdid.getNodePubKey(config.nodeId);
      if (public_key == null) {
        throw new CustomError({
          errorType: errorType.EXTERNAL_SIGN_TEST_FAILED_NO_PUB_KEY,
        });
      }
    }
    await testSignCallback(signCallbackUrl, public_key);

    callbackUrls.sign_url = signCallbackUrl;
    fs.writeFile(
      callbackUrlFilesPrefix + '-signature',
      signCallbackUrl,
      (err) => {
        if (err) {
          logger.error({
            message: '[DPKI] Cannot write sign callback url file',
            error: err,
          });
        }
      }
    );
    masterEventEmitter.emit('dpki_callback_url_changed', {
      sign_url: signCallbackUrl,
    });
  }
  if (masterSignCallbackUrl) {
    const master_public_key = await tendermintNdid.getNodeMasterPubKey(
      config.nodeId
    );
    if (master_public_key == null) {
      throw new CustomError({
        errorType: errorType.EXTERNAL_MASTER_SIGN_TEST_FAILED_NO_PUB_KEY,
      });
    }
    await testSignCallback(masterSignCallbackUrl, master_public_key, true);

    callbackUrls.master_sign_url = masterSignCallbackUrl;
    fs.writeFile(
      callbackUrlFilesPrefix + '-masterSignature',
      masterSignCallbackUrl,
      (err) => {
        if (err) {
          logger.error({
            message: '[DPKI] Cannot write master-sign callback url file',
            error: err,
          });
        }
      }
    );
    masterEventEmitter.emit('dpki_callback_url_changed', {
      master_sign_url: masterSignCallbackUrl,
    });
  }
  if (decryptCallbackUrl) {
    if (public_key == null) {
      public_key = await tendermintNdid.getNodePubKey(config.nodeId);
      if (public_key == null) {
        throw new CustomError({
          errorType: errorType.EXTERNAL_DECRYPT_TEST_FAILED_NO_PUB_KEY,
        });
      }
    }
    await testDecryptCallback(decryptCallbackUrl, public_key);

    callbackUrls.decrypt_url = decryptCallbackUrl;
    fs.writeFile(
      callbackUrlFilesPrefix + '-decrypt',
      decryptCallbackUrl,
      (err) => {
        if (err) {
          logger.error({
            message: '[DPKI] Cannot write sign callback url file',
            error: err,
          });
        }
      }
    );
    masterEventEmitter.emit('dpki_callback_url_changed', {
      decrypt_url: decryptCallbackUrl,
    });
  }
  checkAndEmitAllCallbacksSet();
}

async function callbackWithRetry(url, body, logPrefix) {
  pendingCallbacksCount++;

  const cbId = randomBase64Bytes(10);
  logger.info({
    message: `[${logPrefix}] Calling callback`,
    url,
    cbId,
  });
  logger.debug({
    message: `[${logPrefix}] Callback data in body`,
    body,
  });

  const backoff = new ExponentialBackoff({
    min: 5000,
    max: 180000,
    factor: 2,
    jitter: 0.2,
  });
  const startTime = Date.now();

  for (;;) {
    if (stopCallbackRetry) return;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      logger.info({
        message: `[${logPrefix}] response`,
        cbId,
        httpStatusCode: response.status,
      });
      pendingCallbacksCount--;
      if (response.status !== 200) {
        throw new CustomError({
          message: `[${logPrefix}] Got response status other than 200`,
          details: {
            url,
            cbId,
            httpStatusCode: response.status,
          },
        });
      }
      const responseBody = await response.text();
      return responseBody;
    } catch (error) {
      if (error && error.name === 'CustomError') throw error;

      const nextRetry = backoff.next();

      logger.error({
        message: `[${logPrefix}] Cannot send callback`,
        error,
        cbId,
      });

      if (
        Date.now() - startTime + nextRetry >
        config.callbackRetryTimeout * 1000
      ) {
        pendingCallbacksCount--;
        throw new CustomError({
          message: `[${logPrefix}] callback retry timed out`,
          details: {
            url,
            cbId,
            callbackRetryTimedOut: true,
          },
        });
      }

      logger.info({
        message: `[${logPrefix}] Retrying callback in ${nextRetry} milliseconds`,
        cbId,
      });

      const waitPromise = wait(nextRetry, true);
      waitPromises.push(waitPromise);
      await waitPromise;
      waitPromises.splice(waitPromises.indexOf(waitPromise), 1);
    }
  }
}

export async function decryptAsymetricKey(nodeId, encryptedMessage) {
  const url = callbackUrls.decrypt_url;
  if (url == null) {
    throw new CustomError({
      errorType: errorType.EXTERNAL_DECRYPT_URL_NOT_SET,
    });
  }
  const body = {
    node_id: nodeId,
    encrypted_message: encryptedMessage,
    key_type: 'RSA',
  };
  try {
    const responseBody = await callbackWithRetry(
      url,
      body,
      'External decrypt with node key'
    );

    let result;
    try {
      result = JSON.parse(responseBody);
      logger.debug({
        message: 'External decrypt with node key response body',
        bodyJSON: result,
      });
    } catch (error) {
      logger.debug({
        message: 'External decrypt with node key response body',
        body: responseBody,
      });
      throw new CustomError({
        message: 'External decrypt with node key: Cannot parse JSON',
        cause: error,
      });
    }

    const decryptedMessageBase64 = result.decrypted_message;
    if (typeof decryptedMessageBase64 !== 'string') {
      throw new CustomError({
        message: `Unexpected decrypted message value type: expected string, got ${typeof decryptedMessageBase64}`,
        details: {
          decryptedMessage: decryptedMessageBase64,
        },
      });
    }

    const decryptedMessageBuffer = Buffer.from(
      decryptedMessageBase64,
      'base64'
    );

    // Check if string is base64 string
    if (decryptedMessageBuffer.toString('base64') !== decryptedMessageBase64) {
      throw new CustomError({
        message:
          'Unexpected decrypted message value type: expected base64 string',
        details: {
          decryptedMessage: decryptedMessageBase64,
        },
      });
    }

    return decryptedMessageBuffer;
  } catch (error) {
    logger.error({
      message: 'Error calling external crypto service: decrypt',
      callbackUrl: url,
    });
    throw error;
  }
}

export async function createSignature(
  message,
  messageHash,
  nodeId,
  useMasterKey
) {
  const url = useMasterKey
    ? callbackUrls.master_sign_url
    : callbackUrls.sign_url;
  if (url == null) {
    if (useMasterKey) {
      throw new CustomError({
        errorType: errorType.EXTERNAL_SIGN_MASTER_URL_NOT_SET,
      });
    } else {
      throw new CustomError({
        errorType: errorType.EXTERNAL_SIGN_URL_NOT_SET,
      });
    }
  }
  const body = {
    node_id: nodeId,
    request_message: message,
    request_message_hash: messageHash,
    hash_method: 'SHA256',
    key_type: 'RSA',
    sign_method: 'RSA-SHA256',
  };
  try {
    const responseBody = await callbackWithRetry(
      url,
      body,
      'External sign with node key'
    );

    let result;
    try {
      result = JSON.parse(responseBody);
      logger.debug({
        message: 'External sign with node key response body',
        bodyJSON: result,
      });
    } catch (error) {
      logger.debug({
        message: 'External sign with node key response body',
        body: responseBody,
      });
      throw new CustomError({
        message: 'External sign with node key: Cannot parse JSON',
        cause: error,
      });
    }

    const signatureBase64 = result.signature;
    if (typeof signatureBase64 !== 'string') {
      throw new CustomError({
        message: `Unexpected signature value type: expected string, got ${typeof signatureBase64}`,
        details: {
          signature: signatureBase64,
        },
      });
    }

    const signatureBuffer = Buffer.from(signatureBase64, 'base64');

    // Check if string is base64 string
    if (signatureBuffer.toString('base64') !== signatureBase64) {
      throw new CustomError({
        message: 'Unexpected signature value type: expected base64 string',
        details: {
          signature: signatureBase64,
        },
      });
    }

    return signatureBuffer;
  } catch (error) {
    logger.error({
      message: 'Error calling external crypto service: sign',
      useMasterKey,
      callbackUrl: url,
    });
    throw error;
  }
}

export function stopAllCallbackRetries() {
  stopCallbackRetry = true;
  waitPromises.forEach((waitPromise) => waitPromise.stop());
  logger.info({
    message: 'Stopped all external crypto service callback retries',
  });
}

export function getPendingCallbacksCount() {
  return pendingCallbacksCount;
}
