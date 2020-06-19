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

import grpc from 'grpc';
import path from 'path';
import * as protoLoader from '@grpc/proto-loader';
import * as config from '../config';

export const RESULT_TYPE = {
  "OK":               0,
  "INVALID_TOKEN":    1,
  "CONNECTION_ERROR": 2,
};

export default class GRPCTelemetryClient {
  constructor() {
    const packageDefinition = protoLoader.loadSync(
      path.join(__dirname, '..', '..', '..', 'protos', 'ndid_telemetry_api.proto'),
      {
        keepCase: true,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );
    const proto = grpc.loadPackageDefinition(packageDefinition);

    this.client = new proto.ndid.telemetry.api.NDIDTelemetry(
      config.telemetryNodeAddress,
      grpc.credentials.createInsecure(),
      /*
      {
        'grpc.keepalive_time_ms': config.grpcPingInterval,
        'grpc.keepalive_timeout_ms': config.grpcPingTimeout,
        'grpc.keepalive_permit_without_calls': 1,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': config.grpcPingInterval,
      }
      */
    );
  }

  async waitForReady() {
    await new Promise((resolve, reject) => {
      this.client.waitForReady(Infinity, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  isOk(result) {
    return result === RESULT_TYPE.OK;
  }

  isTokenInvalid(result) {
    return result === RESULT_TYPE.INVALID_TOKEN;
  }

  async sendRequestEvents({
    nodeId,
    token,
    events,
  }) {
    return RESULT_TYPE.OK;
    /*
    return this.client.sendRequestTimestamp({
      requestMetadata: { nodeId, token, },
      events,
    });
    */
  }
};
