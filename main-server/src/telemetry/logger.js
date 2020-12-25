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

import * as telemetryDb from '../db/telemetry';
// import logger from '../logger';

export const REQUEST_EVENTS = {
  RP_CREATES_REQUEST: 1,
  RP_SENDS_REQUEST_TO_IDP: 2,
  IDP_RECEIVES_REQUEST: 3,
  IDP_NOTIFIES_USER: 4,
  IDP_RECEIVES_AUTH_RESULT: 5,
  IDP_CREATES_RESPONSE: 6,
  IDP_RESPONDS_TO_RP: 7,
  RP_RECEIVES_IDP_RESPONSE: 8,
  RP_REQUESTS_AS_DATA: 9,
  AS_RECEIVES_RP_REQUEST: 10,
  AS_QUERIES_DATA: 11,
  AS_RECEIVES_QUERIED_DATA: 12,
  AS_LOGS_HASH_DATA: 13,
  AS_SENDS_DATA_TO_RP: 14,
  RP_RECEIVES_DATA: 15,
  RP_ACCEPTS_DATA: 16,
  RP_CLOSES_OR_TIMES_OUT_REQUEST: 17,

  AS_RECEIVES_PAYMENT: 18,
};

const validRequestEventCodes = Object.values(REQUEST_EVENTS);

export default class TelemetryLogger {
  /*
   * TelemetryLogger Constructor
   *
   * @param {Boolean} option.enable
   * @param {Object} option.tokenInfo
   */
  constructor({ enable }) {
    this.enable = enable;
    if (!enable) return;
  }

  // Request Logging Module

  /*
   * getCurrentTime returns the current time for timestamp
   */
  getCurrentTime() {
    return Date.now();
  }

  async logMainVersion({ nodeId, version }) {
    if (!this.enable) return;

    // prevent duplicates on the same run
    if (this.mainVersion === version) {
      return;
    }

    await telemetryDb.addMainVersionLog(nodeId, {
      node_id: nodeId,
      version,
      source_timestamp: this.getCurrentTime(),
    });

    this.mainVersion = version;
  }

  async logMQServiceVersion({ nodeId, version }) {
    if (!this.enable) return;

    // prevent duplicates on the same run
    if (this.mqServiceVersion === version) {
      return;
    }

    await telemetryDb.addMQServiceVersionLog(nodeId, {
      node_id: nodeId,
      version,
      source_timestamp: this.getCurrentTime(),
    });

    this.mqServiceVersion = version;
  }

  async logTendermintAndABCIVersions({
    nodeId,
    tendermintVersion,
    abciVersion,
  }) {
    if (!this.enable) return;

    // prevent duplicates on the same run
    if (
      this.tendermintVersion === tendermintVersion &&
      this.abciVersion != null &&
      this.abciVersion.version === abciVersion.version &&
      this.abciVersion.appVersion === abciVersion.appVersion
    ) {
      return;
    }

    await telemetryDb.addTendermintAndABCIVersionLog(nodeId, {
      node_id: nodeId,
      tendermint_version: tendermintVersion,
      abci_version: abciVersion.version,
      abci_app_version: abciVersion.appVersion,
      source_timestamp: this.getCurrentTime(),
    });

    this.tendermintVersion = tendermintVersion;
    this.abciVersion = abciVersion;
  }

  /*
   * logRequestEvent saves the information regarding requestID
   */
  async logRequestEvent(request_id, node_id, state_code, additional_data) {
    if (!this.enable) return;
    if (!validRequestEventCodes.includes(state_code)) {
      throw new Error(`Unknown state code: ${state_code}`);
    }

    const data = {
      request_id,
      node_id,
      state_code,
      source_timestamp: this.getCurrentTime(),
      additional_data,
    };

    await telemetryDb.addNewRequestEvent(node_id, data);
  }
}
