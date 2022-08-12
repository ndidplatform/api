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

/** 
 * This library derived from 
 * https://github.com/bomu-bomu/dcontract-msg-validator 
 * by the original author
 * 
 */

import fetch from 'node-fetch';

import * as cryptoUtils from '../../utils/crypto';
import { createResponse } from './create_response';
import logger from '../../logger';
import { dcontractConfig } from '../../config';

/*global globalThis*/
const { AbortController } = globalThis;
const DOCUMENT_INTEGRITY_FAILED = 31000;

/**
 * Extract Hash URL from requestMessage
 * URL must be in NDID compatible format
 * @param {string} requestMessage
 * @returns {Array<string>} list of url message
 */
function extractURLFromRequestMessage(requestMessage) {
  if (typeof requestMessage !== 'string') {
    return [];
  }
  // 1. Strip text
  // 2. extract with newline
  const token = requestMessage.trim().split(/\n+/);
  // 3. get last message start with http* scheme
  return token.filter((line) => line.match(/^http(s?):\/\//)).map((line) => line.trim());
}

/**
 * Validate Contract Hash from requestMessage
 * return true if url inside request message has valid signature
 * @param {string} requestMessage NDID request message
 * @returns {boolean} validation result <true/false>
 */
async function checkContractHash(requestMessage, opt = {}) {
  const timeoutTime = opt.timeout || dcontractConfig.fetchTimeout;
  /**
   * Validate individual url and hash data
   * @param {} url
   * @returns
   */
  async function validateUrl(url) {
    const uri = new URL(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutTime);

    try {
      const response = await fetch(uri, { signal: controller.signal });

      if (response?.status !== 200) {
        throw new Error(`request to ${uri.href} failed: ${response?.statusText}`);
      }
      const urlSplit = url.split('/');
      const urlHash = urlSplit[urlSplit.length - 1];
      const content = await response.buffer();

      const contentHash = cryptoUtils.sha256(content).toString('hex');

      return contentHash === urlHash;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`request to ${url} failed: Timeout after ${timeoutTime}ms`);
      } else {
        throw err;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    // 1. Extract requestMessage to list of URL
    const urls = extractURLFromRequestMessage(requestMessage);

    // Fail if no url to be validated
    if (urls.length < 1) {
      logger.error({ message: 'No contract url' });
      return false;
    }

    // 2. Do url validation concurrently
    const validators = urls.map((url) => validateUrl(url));
    const results = await Promise.all(validators);

    // 3. pass if all data is pass
    return results.every((result) => result === true);
  } catch (err) {
    logger.error({ message: err.message });
    return false;
  }
}

/**
 * Create error response when contract integrity check failed
 * @param {Sting} request_id 
 * @param {String} callback_url 
 */
async function createContractErrorResponse(
  request_id,
  callback_url
) {
  await createResponse(
    {
      request_id,
      callback_url,
      error_code: DOCUMENT_INTEGRITY_FAILED,
    },
    {}
  );
}

/**
 * Check Document Integrity if request type is dcontract
 * true if ok, false otherwise
 * @param {String} requestId 
 * @param {Object} request 
 * @param {Object} requestDetail 
 * @param {Function} callbackUrlFn 
 * @returns {boolean}
 */
export async function checkContractDocumentIntegrity(
  requestId,
  request,
  requestDetail,
  callbackUrlFn
) {
  if (!dcontractConfig.validateContract) {
    return true;
  }

  if (requestDetail.request_type !== 'dcontract') {
    return true;
  }

  logger.debug({
    message: 'Validate dContract request document', requestId
  });

  const result = await checkContractHash(request.request_message);
  if (result) {
    return true;
  }

  logger.error({
    message: `dContract integrity result: ${result}`, requestId
  });
  createContractErrorResponse(requestId, await callbackUrlFn());
  return false;
}
