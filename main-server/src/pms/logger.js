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

import pmsDb from '../db/pms'
import logger from '../logger.js'
import * as utils from '../utils';
import * as config from '../config';

export const REQUEST_EVENTS = {
  RP_CREATES_REQUEST         : 1,
  RP_SENDS_REQUEST_ID_TO_IDP : 2,
  IDP_RECEIVES_REQUEST_ID    : 3,
  IDP_NOTIFIES_USER          : 4,
  IDP_RECEIVES_AUTH_RESULT   : 5,
  IDP_CREATES_RESPONSE       : 6,
  IDP_RESPONDS_TO_RP         : 7,
  RP_RECEIVES_RESPONSE       : 8,
  RP_REQUESTS_AS_DATA        : 9,
  AS_RECEIVES_RP_REQUEST     : 10,
  AS_QUERIES_DATA            : 11,
  AS_RECEIVES_QUERIED_DATA   : 12,
  AS_LOGS_HASH_DATA          : 13,
  AS_SENDS_DATA_TO_RP        : 14,
  RP_RECEIVES_DATA           : 15,
  RP_ACCEPTS_DATA            : 16,
  RP_CLOSES_REQUEST          : 17,
}

export default class PMSLogger {
  /*
   * PMSLogger Constructor
   *
   * @param {boolean} option.enable
   * @param {string} option.redisIp
   * @param {integer} option.redisPort
   * @param {string} option.redisPassword
   */
  constructor({
    enable,
  }) {
    this.enable = enable;
    if (!enable) return;

    this.createTokenGenerationTimeout(5 * 60 * 60, {});
  }

  // Request Logging Module

  /*
   * getCurrentTime returns the current time for timestamp
   */
  getCurrentTime() {
    return Date.now();
  }

  /*
   * logRequestEvent saves the information regarding requestID
   */
  async logRequestEvent(request_id, node_id, state) {
    if (!this.enable) return;
    const data = {
      request_id,
      node_id,
      state,
      timestamp: this.getCurrentTime(),
    };

    await pmsDb.addNewRequestEvent(node_id, JSON.stringify(data));
  }

  // TOKEN Generation Module

  /*
   * Generate a new token and public it to redis db
   *
   * @param {integer} config.timeout (time until token is expired, default: 6hrs).
   * @param {object} config.extraInfo (additional data).
   */
  async generateToken({
    timeout = 6 * 60 * 60, // default 6 hours
    extraInfo = {},
  }) {
    if (!this.enable) return;

    logger.info("Generating new PMS token");

    const payload = {
      expire: Date.now() + timeout,
      nonce: Math.random(),
      ...extraInfo,
    };

    const payloadJSON = JSON.stringify(payload);

    const payloadSigned = await utils.createSignature(payloadJSON);
    await pmsDb.addNewToken(config.nodeId, payloadSigned);
    logger.info("Finish generating PMS token");
  }

  /*
   * Register token generation interval
   *
   * @param {integer} timeout (time between two tokens)
   * @param {Object} tokenInformation (refers to generateToken)
   */
  async createTokenGenerationTimeout(timeout, tokenInformation) {
    if (!this.enable) return;
    this.disableTokenGeneration();
    try {
      await this.generateToken(tokenInformation);
      this.tokenGenerationTimeoutID = setTimeout(
        async () => await this.createTokenGenerationTimeout(timeout, tokenInformation),
        timeout,
      );
    } catch (e) {
      logger.error("Failed to generate PMS token, retry in 10 seconds");
      timeout = 10000;
    }
    this.tokenGenerationTimeoutID = setTimeout(
      async () => await this.createTokenGenerationTimeout(timeout, tokenInformation),
      timeout,
    );
  }

  /*
   * Remove token generation timeout
   */
  disableTokenGeneration() {
    if (this.tokenGenerationTimeoutID) {
      clearTimeout(this.tokenGenerationTimeoutID);
    }
  }
}

