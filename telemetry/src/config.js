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

// Load configuration variables from process.env
import './config_validate';

export const env = process.env.NODE_ENV || 'development';

export const nodeIds = process.env.NODE_ID;

export const redisDbIp = process.env.TELEMETRY_DB_IP;
export const redisDbPort = process.env.TELEMETRY_DB_PORT;
export const redisDbPassword = process.env.TELEMETRY_DB_PASSWORD;

export const telemetryNodeIp = process.env.TELEMETRY_NODE_IP;
export const telemetryNodePort = process.env.TELEMETRY_NODE_PORT;

export const telemetryNodeAddress = `${telemetryNodeIp}:${telemetryNodePort}`;

export const grpcPingInterval = process.env.GRPC_PING_INTERVAL_MS
  ? parseInt(process.env.GRPC_PING_INTERVAL_MS)
  : 60000;

export const grpcPingTimeout = process.env.GRPC_PING_TIMEOUT_MS
  ? parseInt(process.env.GRPC_PING_TIMEOUT_MS)
  : 20000;

export const flushIntervalMs =
  (parseInt(process.env.FLUSH_INTERVAL_SEC) || 10) * 1000;

export const logLevel =
  process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info');
export const logPrettyPrint = process.env.LOG_PRETTY_PRINT
  ? process.env.LOG_PRETTY_PRINT === 'true'
  : env === 'development';
export const logColor =
  process.env.LOG_COLOR == null
    ? env === 'development'
    : process.env.LOG_COLOR === 'true';
