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

import {
  hash,
  publicEncrypt,
  verifySignature,
  randomBase64Bytes,
} from './crypto';
import * as tendermintNdid from '../tendermint/ndid';
import { wait } from '.';
import CustomError from '../error/custom_error';
import errorType from '../error/type';
import logger from '../logger';

import * as config from '../config';

const TEST_MESSAGE = 'test';
const TEST_MESSAGE_BASE_64 = Buffer.from(TEST_MESSAGE).toString('base64');

const callbackUrls = {};

const callbackUrlFilesPrefix = path.join(
  config.dataDirectoryPath,
  'dpki-callback-url-' + config.nodeId
);

const waitStopFunction = [];
let stopCallbackRetry = false;

export const eventEmitter = new EventEmitter();

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
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn({
        message: `DPKI: ${fileSuffix} callback url file not found`,
      });
    } else {
      logger.error({
        message: `Cannot read DPKI: ${fileSuffix} callback url file`,
        error,
      });
    }
  }
});

async function testSignCallback(url, publicKey) {
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
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const responseBody = await response.text();
  logger.info({
    message: 'Testing external sign with node key: response',
    httpStatusCode: response.status,
    body: responseBody,
  });
  const { signature } = JSON.parse(responseBody);
  if (!verifySignature(signature, publicKey, TEST_MESSAGE)) {
    throw new CustomError({
      message: 'Invalid signature',
    });
  }
}

async function testDecryptCallback(url, publicKey) {
  const encryptedMessage = publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    TEST_MESSAGE
  );
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
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const responseBody = await response.text();
  logger.info({
    message: 'Testing external decrypt with node key: response',
    httpStatusCode: response.status,
    body: responseBody,
  });
  const decryptedMessageBase64 = JSON.parse(responseBody).decrypted_message;
  if (TEST_MESSAGE_BASE_64 !== decryptedMessageBase64) {
    throw new CustomError({
      message: 'Decrypted message mismatch',
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
    try {
      if (public_key == null) {
        public_key = (await tendermintNdid.getNodePubKey(config.nodeId))
          .public_key;
      }
      await testSignCallback(signCallbackUrl, public_key);
    } catch (error) {
      throw new CustomError({
        message: errorType.EXTERNAL_SIGN_TEST_FAILED.message,
        code: errorType.EXTERNAL_SIGN_TEST_FAILED.code,
        cause: error,
      });
    }

    callbackUrls.sign_url = signCallbackUrl;
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
  if (masterSignCallbackUrl) {
    try {
      const { master_public_key } = await tendermintNdid.getNodeMasterPubKey(
        config.nodeId
      );
      await testSignCallback(masterSignCallbackUrl, master_public_key);
    } catch (error) {
      throw new CustomError({
        message: errorType.EXTERNAL_SIGN_MASTER_TEST_FAILED.message,
        code: errorType.EXTERNAL_SIGN_MASTER_TEST_FAILED.code,
        cause: error,
      });
    }

    callbackUrls.master_sign_url = masterSignCallbackUrl;
    fs.writeFile(
      callbackUrlFilesPrefix + '-masterSignature',
      masterSignCallbackUrl,
      (err) => {
        if (err) {
          logger.error({
            message: 'Cannot write DPKI master-sign callback url file',
            error: err,
          });
        }
      }
    );
  }
  if (decryptCallbackUrl) {
    try {
      if (public_key == null) {
        public_key = (await tendermintNdid.getNodePubKey(config.nodeId))
          .public_key;
      }
      await testDecryptCallback(decryptCallbackUrl, public_key);
    } catch (error) {
      throw new CustomError({
        message: errorType.EXTERNAL_DECRYPT_TEST_FAILED.message,
        code: errorType.EXTERNAL_DECRYPT_TEST_FAILED.code,
        cause: error,
      });
    }

    callbackUrls.decrypt_url = decryptCallbackUrl;
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
  checkAndEmitAllCallbacksSet();
}

async function callbackWithRetry(url, body, logPrefix) {
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
      const responseBody = await response.text();
      return responseBody;
    } catch (error) {
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
        throw new CustomError({
          message: `[${logPrefix}] callback retry timed out`,
          details: {
            url,
            cbId,
          },
        });
      }

      logger.info({
        message: `[${logPrefix}] Retrying callback in ${nextRetry} milliseconds`,
        cbId,
      });

      const { promise: waitPromise, stopWaiting } = wait(nextRetry, true);
      waitStopFunction.push(stopWaiting);
      await waitPromise;
      waitStopFunction.splice(waitStopFunction.indexOf(stopWaiting), 1);
    }
  }
}

export async function decryptAsymetricKey(encryptedMessage) {
  const url = callbackUrls.decrypt_url;
  if (url == null) {
    throw new CustomError({
      message: errorType.EXTERNAL_DECRYPT_URL_NOT_SET.message,
      code: errorType.EXTERNAL_DECRYPT_URL_NOT_SET.code,
    });
  }
  const body = {
    node_id: config.nodeId,
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
      throw error;
    }

    const decryptedMessageBase64 = result.decrypted_message;
    if (typeof decryptedMessageBase64 !== 'string') {
      throw new CustomError({
        message: 'Unexpected decrypted message value type: Expected string',
        details: {
          decryptedMessage: decryptedMessageBase64,
        },
      });
    }
    // TODO: check if string is base64

    return Buffer.from(decryptedMessageBase64, 'base64');
  } catch (error) {
    logger.error({
      message: 'Error calling external crypto service: decrypt',
      callbackUrl: url,
    });
    throw error;
  }
}

export async function createSignature(message, messageHash, useMasterKey) {
  const url = useMasterKey
    ? callbackUrls.master_sing_url
    : callbackUrls.sign_url;
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
  const body = {
    node_id: config.nodeId,
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
      throw error;
    }

    const signatureBase64 = result.signature;
    if (typeof signatureBase64 !== 'string') {
      throw new CustomError({
        message: 'Unexpected signature value type: Expected string',
        details: {
          signature: signatureBase64,
        },
      });
    }
    // TODO: check if string is base64

    return signatureBase64;
  } catch (error) {
    logger.error({
      message: 'Error calling external crypto service: sign',
      useMasterKey,
      callbackUrl: url,
    });
    throw error;
  }
}
