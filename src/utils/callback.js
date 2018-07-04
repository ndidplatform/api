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

import fetch from 'node-fetch';
import { ExponentialBackoff } from 'simple-backoff';

import { randomBase64Bytes } from './crypto';

import { wait } from '../utils';
import * as db from '../db';
import logger from '../logger';
import * as config from '../config';

const waitStopFunction = [];
let stopCallbackRetry = false;

/**
 * Make a HTTP POST to callback url with body
 * @param {string} callbackUrl
 * @param {Object} body
 */
async function httpPost(cbId, callbackUrl, body) {
  const response = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  logger.info({
    message: 'Got callback response',
    cbId,
    httpStatusCode: response.status,
  });
  logger.debug({
    message: 'Callback response body',
    cbId,
    body: await response.text(),
  });

  return response;
}

async function callbackWithRetry(
  callbackUrl,
  body,
  cbId,
  shouldRetry,
  shouldRetryArguments = [],
  responseCallback,
  dataForResponseCallback
) {
  const backoff = new ExponentialBackoff({
    min: 5000,
    max: 180000,
    factor: 2,
    jitter: 0.2,
  });

  const startTime = Date.now();

  for (;;) {
    if (stopCallbackRetry) return;
    logger.info({
      message: 'Sending a callback with retry',
      url: callbackUrl,
      cbId,
    });
    logger.debug({
      message: 'Callback data in body',
      body,
      cbId,
    });
    try {
      const response = await httpPost(cbId, callbackUrl, body);

      db.removeCallbackWithRetryData(cbId);
      if (responseCallback) {
        responseCallback(response, dataForResponseCallback);
      }
      return;
    } catch (error) {
      const nextRetry = backoff.next();

      logger.error({
        message: 'Cannot send callback to client application',
        error,
        cbId,
      });

      if (shouldRetry) {
        if (!(await shouldRetry(...shouldRetryArguments))) {
          db.removeCallbackWithRetryData(cbId);
          return;
        }
      } else {
        if (
          Date.now() - startTime + nextRetry >
          config.callbackRetryTimeout * 1000
        ) {
          logger.warn({
            message: 'Callback retry timed out',
            url: callbackUrl,
            cbId,
          });
          db.removeCallbackWithRetryData(cbId);
          return;
        }
      }

      logger.info({
        message: `Retrying callback in ${nextRetry} milliseconds`,
        cbId,
      });

      const { promise: waitPromise, stopWaiting } = wait(nextRetry, true);
      waitStopFunction.push(stopWaiting);
      await waitPromise;
      waitStopFunction.splice(waitStopFunction.indexOf(stopWaiting), 1);
    }
  }
}

/**
 * Send callback to client application
 * @param {string} callbackUrl
 * @param {Object} body
 * @param {boolean} retry
 * @param {function} shouldRetry
 * @param {Array} shouldRetryArguments
 * @param {function} responseCallback
 * @param {Object} dataForResponseCallback
 */
export async function callbackToClient(
  callbackUrl,
  body,
  retry,
  shouldRetry,
  shouldRetryArguments,
  responseCallback,
  dataForResponseCallback
) {
  const cbId = randomBase64Bytes(10);
  if (retry) {
    logger.info({
      message: 'Saving data for callback with retry',
      url: callbackUrl,
      cbId,
    });
    await db.addCallbackWithRetryData(cbId, {
      callbackUrl,
      body,
      shouldRetryFnExist: shouldRetry != null,
      shouldRetryArguments,
      responseCallbackFnExist: responseCallback != null,
      dataForResponseCallback,
    });
    callbackWithRetry(
      callbackUrl,
      body,
      cbId,
      shouldRetry,
      shouldRetryArguments,
      responseCallback,
      dataForResponseCallback
    );
  } else {
    logger.info({
      message: 'Sending a callback without retry',
      url: callbackUrl,
      cbId,
    });
    logger.debug({
      message: 'Callback data in body',
      body,
      cbId,
    });
    try {
      const response = await httpPost(cbId, callbackUrl, body);
      if (responseCallback) {
        responseCallback(response, dataForResponseCallback);
      }
    } catch (error) {
      logger.error({
        message: 'Cannot send callback to client application',
        error,
      });
    }
  }
}

/**
 * Resume all cached retry callback
 * This function should be called only when server starts
 * @param {function} responseCallback
 */
export async function resumeCallbackToClient(shouldRetry, responseCallback) {
  const callbackDatum = await db.getAllCallbackWithRetryData();
  callbackDatum.forEach((callback) =>
    callbackWithRetry(
      callback.data.callbackUrl,
      callback.data.body,
      callback.cbId,
      callback.data.shouldRetryFnExist ? shouldRetry : null,
      callback.data.shouldRetryArguments,
      callback.data.responseCallbackFnExist ? responseCallback : null,
      callback.data.dataForResponseCallback
    )
  );
}

export function stopAllCallbackRetries() {
  stopCallbackRetry = true;
  waitStopFunction.forEach((stopWaiting) => stopWaiting());
  logger.info({
    message: 'Stopped all callback retries',
  });
}
