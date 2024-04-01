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

import { EventEmitter } from 'events';

import fetch from 'node-fetch';
import { ExponentialBackoff } from 'simple-backoff';

import { wait, hash, verifySignature } from './utils';
import * as cryptoUtils from './utils/crypto';
import * as tendermintNdid from './tendermint/ndid';
import * as dataDb from './db/data';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from './logger';

import { externalCryptoServiceCallbackUrlsSet } from './master-worker-interface/client';

import MODE from './mode';
import * as config from './config';

const TEST_MESSAGE = 'test';
const TEST_MESSAGE_BASE_64 = Buffer.from(TEST_MESSAGE).toString('base64');

const CALLBACK_URL_NAME = {
  SIGN: 'sign_url',
  MASTER_SIGN: 'master_sign_url',
  DECRYPT: 'decrypt_url',
};
const CALLBACK_URL_NAME_ARR = Object.values(CALLBACK_URL_NAME);

const waitPromises = [];
let stopCallbackRetry = false;

let pendingCallbacksCount = 0;

export const eventEmitter = new EventEmitter();
export const metricsEventEmitter = new EventEmitter();

export async function checkCallbackUrls() {
  const callbackUrls = await getCallbackUrls();
  for (let i = 0; i < CALLBACK_URL_NAME_ARR.length; i++) {
    const callbackName = CALLBACK_URL_NAME_ARR[i];
    if (callbackUrls[callbackName] != null) {
      logger.info({
        message: `[External Crypto Service] ${callbackName} callback url`,
        callbackUrl: callbackUrls[callbackName],
      });
    } else {
      logger.warn({
        message: `[External Crypto Service] ${callbackName} callback url is not set`,
      });
    }
  }
}

async function testSignCallback(url, publicKey, signatureAlgorithm, isMaster) {
  const body = {
    node_id: config.nodeId,
    request_message: TEST_MESSAGE_BASE_64,
    request_message_hash: hash(signatureAlgorithm.hashAlgorithm, TEST_MESSAGE), // FIXME
    hash_method: signatureAlgorithm.hashAlgorithm,
    key_type: signatureAlgorithm.keyAlgorithm,
    sign_method: signatureAlgorithm.name, // FIXME: backward compatibility ('RSA-SHA256')
    // sign_method: 'RSA-SHA256',
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

  if (
    !verifySignature(
      signatureAlgorithm.name,
      signature,
      publicKey,
      TEST_MESSAGE
    )
  ) {
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

async function testDecryptCallback(url, publicKey, encryptionAlgorithm) {
  const encryptedMessageBuffer = cryptoUtils.publicEncrypt(
    {
      key: publicKey,
      padding: encryptionAlgorithm.padding,
      oaepHash: encryptionAlgorithm.oaepHash,
    },
    TEST_MESSAGE
  );
  const encryptedMessage = encryptedMessageBuffer.toString('base64');
  const body = {
    node_id: config.nodeId,
    encrypted_message: encryptedMessage,
    key_type: encryptionAlgorithm.keyAlgorithm,
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

export async function getCallbackUrls() {
  const callbackNames = CALLBACK_URL_NAME_ARR.map(
    (name) => `external_crypto_service.${name}`
  );
  const callbackUrlsArr = await dataDb.getCallbackUrls(
    config.nodeId,
    callbackNames
  );
  const callbackUrls = callbackUrlsArr.reduce((callbackUrlsObj, url, index) => {
    if (url != null) {
      return {
        ...callbackUrlsObj,
        [callbackNames[index].replace(/^external_crypto_service\./, '')]: url,
      };
    } else {
      return callbackUrlsObj;
    }
  }, {});
  return callbackUrls;
}

function getSignCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `external_crypto_service.${CALLBACK_URL_NAME.SIGN}`
  );
}

function setSignCallbackUrl(url) {
  return dataDb.setCallbackUrl(
    config.nodeId,
    `external_crypto_service.${CALLBACK_URL_NAME.SIGN}`,
    url
  );
}

function getMasterSignCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `external_crypto_service.${CALLBACK_URL_NAME.MASTER_SIGN}`
  );
}

function setMasterSignCallbackUrl(url) {
  return dataDb.setCallbackUrl(
    config.nodeId,
    `external_crypto_service.${CALLBACK_URL_NAME.MASTER_SIGN}`,
    url
  );
}

function getDecryptCallbackUrl() {
  return dataDb.getCallbackUrl(
    config.nodeId,
    `external_crypto_service.${CALLBACK_URL_NAME.DECRYPT}`
  );
}

function setDecryptCallbackUrl(url) {
  return dataDb.setCallbackUrl(
    config.nodeId,
    `external_crypto_service.${CALLBACK_URL_NAME.DECRYPT}`,
    url
  );
}

export async function isCallbackUrlsSet() {
  const callbackUrls = await getCallbackUrls();
  return (
    callbackUrls.sign_url != null &&
    callbackUrls.master_sign_url != null &&
    callbackUrls.decrypt_url != null
  );
}

export async function checkAndEmitAllCallbacksSet() {
  if (await isCallbackUrlsSet()) {
    eventEmitter.emit('allCallbacksSet');
  }
}

export async function setCallbackUrls({
  signCallbackUrl,
  masterSignCallbackUrl,
  decryptCallbackUrl,
}) {
  if (signCallbackUrl) {
    const signingPubKey = await tendermintNdid.getNodeSigningPubKey(
      config.nodeId
    );
    if (signingPubKey == null) {
      throw new CustomError({
        errorType: errorType.EXTERNAL_SIGN_TEST_FAILED_NO_PUB_KEY,
      });
    }

    const sigAlg = cryptoUtils.signatureAlgorithm[signingPubKey.algorithm];
    if (sigAlg == null) {
      throw new Error('unknown/unsupported algorithm');
    }

    await testSignCallback(signCallbackUrl, signingPubKey.public_key, sigAlg);
    await setSignCallbackUrl(signCallbackUrl);
  }
  if (masterSignCallbackUrl) {
    const signingMasterPubKey = await tendermintNdid.getNodeSigningMasterPubKey(
      config.nodeId
    );
    if (signingMasterPubKey == null) {
      throw new CustomError({
        errorType: errorType.EXTERNAL_MASTER_SIGN_TEST_FAILED_NO_PUB_KEY,
      });
    }

    const sigAlg =
      cryptoUtils.signatureAlgorithm[signingMasterPubKey.algorithm];
    if (sigAlg == null) {
      throw new Error('unknown/unsupported algorithm');
    }

    await testSignCallback(
      masterSignCallbackUrl,
      signingMasterPubKey.public_key,
      sigAlg,
      true
    );
    await setMasterSignCallbackUrl(masterSignCallbackUrl);
  }
  if (decryptCallbackUrl) {
    const encPubKey = await tendermintNdid.getNodeEncryptionPubKey(
      config.nodeId
    );
    if (encPubKey == null) {
      throw new CustomError({
        errorType: errorType.EXTERNAL_DECRYPT_TEST_FAILED_NO_PUB_KEY,
      });
    }

    const encAlg = cryptoUtils.encryptionAlgorithm[encPubKey.algorithm];
    if (encAlg == null) {
      throw new Error('unknown/unsupported algorithm');
    }

    await testDecryptCallback(decryptCallbackUrl, encPubKey.public_key, encAlg);
    await setDecryptCallbackUrl(decryptCallbackUrl);
  }
  if (config.mode === MODE.WORKER) {
    await externalCryptoServiceCallbackUrlsSet();
  }
  await checkAndEmitAllCallbacksSet();
}

async function callbackWithRetry(url, body, logPrefix, type) {
  incrementPendingCallbacksCount();

  const cbId = cryptoUtils.randomBase64Bytes(10);
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
      decrementPendingCallbacksCount();
      metricsEventEmitter.emit(
        'callbackTime',
        type,
        response.status,
        Date.now() - startTime
      );
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
        err: error,
        cbId,
      });

      if (
        Date.now() - startTime + nextRetry >
        config.callbackRetryTimeout * 1000
      ) {
        decrementPendingCallbacksCount();
        metricsEventEmitter.emit('callbackTimedOut');
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

export async function decryptAsymetricKey(
  nodeId,
  encryptionAlgorithm,
  encryptedMessage
) {
  const url = await getDecryptCallbackUrl();
  if (url == null) {
    throw new CustomError({
      errorType: errorType.EXTERNAL_DECRYPT_URL_NOT_SET,
    });
  }
  const body = {
    node_id: nodeId,
    encrypted_message: encryptedMessage,
    key_type: encryptionAlgorithm.keyAlgorithm,
  };
  try {
    const responseBody = await callbackWithRetry(
      url,
      body,
      'External decrypt with node key',
      'decrypt'
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
  signatureAlgorithm,
  messageBase64,
  messageHash,
  nodeId,
  useMasterKey
) {
  let url;
  if (useMasterKey) {
    url = await getMasterSignCallbackUrl();
  } else {
    url = await getSignCallbackUrl();
  }
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
    request_message: messageBase64,
    request_message_hash: messageHash,
    hash_method: signatureAlgorithm.hashAlgorithm,
    key_type: signatureAlgorithm.keyAlgorithm,
    sign_method: signatureAlgorithm.name, // FIXME: backward compatibility ('RSA-SHA256')
    // sign_method: 'RSA-SHA256',
  };
  try {
    const responseBody = await callbackWithRetry(
      url,
      body,
      'External sign with node key',
      'sign'
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

function incrementPendingCallbacksCount() {
  pendingCallbacksCount++;
  metricsEventEmitter.emit('pendingCallbacksCount', pendingCallbacksCount);
}

function decrementPendingCallbacksCount() {
  pendingCallbacksCount--;
  metricsEventEmitter.emit('pendingCallbacksCount', pendingCallbacksCount);
}

export function getPendingCallbacksCount() {
  return pendingCallbacksCount;
}
