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

import * as grpc from '@grpc/grpc-js';
import path from 'path';
import fs from 'fs';
import tls from 'tls';
import * as protoLoader from '@grpc/proto-loader';
import * as config from '../config';
import logger from '../logger';

const APP_RESPONSE_CODE = {
  OK: 0,
  UNKNOWN_ERROR: 1,
  INVALID_INPUT: 2,
  INVALID_AUTH_TOKEN: 3,
  AUTH_TOKEN_EXPIRED: 4,
  INVALID_AUTH_TOKEN_SIGNATURE: 5,
  UNKNOWN_VERSION: 1001,
};

const GRPC_API_VERSION = '1.0';

export default class GRPCTelemetryClient {
  constructor() {
    const packageDefinition = protoLoader.loadSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'protos',
        'ndid_telemetry_api.proto'
      ),
      {
        keepCase: true,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );
    const proto = grpc.loadPackageDefinition(packageDefinition);

    let grpcSslRootCert;
    let grpcSslKey;
    let grpcSslCert;
    if (config.grpcSsl) {
      if (config.grpcSslRootCertFilePath) {
        grpcSslRootCert = fs.readFileSync(config.grpcSslRootCertFilePath);
      } else {
        grpcSslRootCert = Buffer.from(tls.rootCertificates.join('\n'));
      }
      if (config.grpcSslKeyFilePath) {
        grpcSslKey = fs.readFileSync(config.grpcSslKeyFilePath);
      }
      if (config.grpcSslCertFilePath) {
        grpcSslCert = fs.readFileSync(config.grpcSslCertFilePath);
      }
    }
    this.client = new proto.ndid.telemetry.api.NDIDTelemetry(
      config.telemetryNodeGrpcAddress,
      config.grpcSsl
        ? grpc.credentials.createSsl(grpcSslRootCert, grpcSslKey, grpcSslCert)
        : grpc.credentials.createInsecure(),
      {
        'grpc.keepalive_time_ms': config.grpcPingInterval,
        'grpc.keepalive_timeout_ms': config.grpcPingTimeout,
        'grpc.keepalive_permit_without_calls': 1,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': config.grpcPingInterval,
      }
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
    return result.code === APP_RESPONSE_CODE.OK;
  }

  isTokenInvalid(result) {
    return (
      result.code === APP_RESPONSE_CODE.INVALID_AUTH_TOKEN ||
      result.code === APP_RESPONSE_CODE.AUTH_TOKEN_EXPIRED ||
      result.code === APP_RESPONSE_CODE.INVALID_AUTH_TOKEN_SIGNATURE
    );
  }

  sendMainVersionLogs({ nodeId, token, logs }) {
    logger.info({
      message: 'Attempt connecting GRPC server',
      function: 'sendMainVersionLogs',
    });
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      metadata.add('version', GRPC_API_VERSION);
      this.client.sendMainVersionLogs(
        {
          request_metadata: { node_id: nodeId, token },
          data: logs,
        },
        metadata,
        (err, result) => {
          if (err) reject(err);
          logger.debug(result);
          resolve(result);
        }
      );
    });
  }

  sendMQServiceVersionLogs({ nodeId, token, logs }) {
    logger.info({
      message: 'Attempt connecting GRPC server',
      function: 'sendMQServiceVersionLogs',
    });
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      metadata.add('version', GRPC_API_VERSION);
      this.client.sendMqServiceVersionLogs(
        {
          request_metadata: { node_id: nodeId, token },
          data: logs,
        },
        metadata,
        (err, result) => {
          if (err) reject(err);
          logger.debug(result);
          resolve(result);
        }
      );
    });
  }

  sendTendermintAndABCIVersionLogs({ nodeId, token, logs }) {
    logger.info({
      message: 'Attempt connecting GRPC server',
      function: 'sendTendermintAndABCIVersionLogs',
    });
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      metadata.add('version', GRPC_API_VERSION);
      this.client.sendTendermintAndAbciVersionLogs(
        {
          request_metadata: { node_id: nodeId, token },
          data: logs,
        },
        metadata,
        (err, result) => {
          if (err) reject(err);
          logger.debug(result);
          resolve(result);
        }
      );
    });
  }

  sendRequestEvents({ nodeId, token, events }) {
    logger.info({
      message: 'Attempt connecting GRPC server',
      function: 'sendRequestEvents',
    });
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      metadata.add('version', GRPC_API_VERSION);
      this.client.sendRequestEvents(
        {
          request_metadata: { node_id: nodeId, token },
          data: events,
        },
        metadata,
        (err, result) => {
          if (err) reject(err);
          logger.debug(result);
          resolve(result);
        }
      );
    });
  }
}
