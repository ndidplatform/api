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

import path from 'path';

export const env = process.env.NODE_ENV || 'development';

const defaultMqBindingPort = 5555;

export const mqPort =
  process.env.MQ_BINDING_PORT == null
    ? defaultMqBindingPort
    : parseInt(process.env.MQ_BINDING_PORT);

export const serverPort = process.env.SERVER_PORT
  ? parseInt(process.env.SERVER_PORT)
  : 50051;

export const grpcPingInterval = process.env.GRPC_PING_INTERVAL_MS
  ? parseInt(process.env.GRPC_PING_INTERVAL_MS)
  : 300000;

export const grpcPingTimeout = process.env.GRPC_PING_TIMEOUT_MS
  ? parseInt(process.env.GRPC_PING_TIMEOUT_MS)
  : 20000;

export const grpcExpectedClientPingInterval = process.env
  .GRPC_EXPECTED_CLIENT_PING_INTERVAL_MS
  ? parseInt(process.env.GRPC_EXPECTED_CLIENT_PING_INTERVAL_MS)
  : 30000;

export const nodeId = process.env.NODE_ID;

export const logLevel =
  process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info');
// export const logFormat = process.env.LOG_FORMAT || 'default';
// export const logTarget = process.env.LOG_TARGET || 'console';
export const logPrettyPrint = process.env.LOG_PRETTY_PRINT
  ? process.env.LOG_PRETTY_PRINT === 'true'
  : env === 'development';
export const logColor =
  process.env.LOG_COLOR == null
    ? env === 'development'
    : process.env.LOG_COLOR === 'true';
// export const logOneLine = process.env.LOG_ONE_LINE === 'true';
// export const logDirectoryPath =
//   process.env.LOG_DIRECTORY_PATH || path.join(__dirname, '..', 'log');

export const maxConcurrentMessagesPerMqSocket =
  process.env.MAX_CONCURRENT_MESSAGES_PER_MQ_SOCKET || 16;

export const maxMqSockets = process.env.MAX_MQ_SOCKETS || 10000;

export const prometheusEnabled = process.env.PROMETHEUS === 'true';

export const prometheusServerPort = process.env.PROMETHEUS_SERVER_PORT
  ? parseInt(process.env.PROMETHEUS_SERVER_PORT)
  : 8888;

export const prometheusHttps = process.env.PROMETHEUS_HTTPS === 'true';

export const prometheusHttpsKeyPath =
  process.env.PROMETHEUS_HTTPS_KEY_PATH != null
    ? process.env.PROMETHEUS_HTTPS_KEY_PATH
    : path.join(__dirname, '..', 'dev_https_key', 'key.pem');
export const prometheusHttpsCertPath =
  process.env.PROMETHEUS_HTTPS_CERT_PATH != null
    ? process.env.PROMETHEUS_HTTPS_CERT_PATH
    : path.join(__dirname, '..', 'dev_https_key', 'cert.pem');
