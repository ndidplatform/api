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

//allow self signed https callback
if (env === 'development') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const serverPort = process.env.SERVER_PORT
  ? parseInt(process.env.SERVER_PORT)
  : 8080;

export const https = process.env.HTTPS === 'true';
export const httpsKeyPath =
  process.env.HTTPS_KEY_PATH != null
    ? process.env.HTTPS_KEY_PATH
    : path.join(__dirname, '..', 'dev_https_key', 'key.pem');
export const httpsCertPath =
  process.env.HTTPS_CERT_PATH != null
    ? process.env.HTTPS_CERT_PATH
    : path.join(__dirname, '..', 'dev_https_key', 'cert.pem');

export const clientHttpErrorCode = process.env.CLIENT_HTTP_ERROR_CODE || 400;
export const serverHttpErrorCode = process.env.SERVER_HTTP_ERROR_CODE || 500;

let _defaultApiVersion = process.env.DEFAULT_API_VERSION
  ? process.env.DEFAULT_API_VERSION
  : '5.1';
if (_defaultApiVersion === '4') {
  _defaultApiVersion = '4.0';
} else if (_defaultApiVersion === '5') {
  _defaultApiVersion = '5.1';
}
export const defaultApiVersion = _defaultApiVersion;

let _callbackApiVersion = process.env.CALLBACK_API_VERSION
  ? process.env.CALLBACK_API_VERSION
  : '5.1';
if (_callbackApiVersion === '4') {
  _callbackApiVersion = '4.0';
} else if (_callbackApiVersion === '5') {
  _callbackApiVersion = '5.1';
}
export const callbackApiVersion = _callbackApiVersion;

export const dbIp = process.env.DB_IP || 'localhost';
export const dbPort = process.env.DB_PORT
  ? parseInt(process.env.DB_PORT)
  : 6379;
export const dbPassword = process.env.DB_PASSWORD;

export const dataDirectoryPath =
  process.env.DATA_DIRECTORY_PATH || path.join(__dirname, '..', 'data');

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
export const logOneLine = process.env.LOG_ONE_LINE === 'true';
// export const logDirectoryPath =
//   process.env.LOG_DIRECTORY_PATH || path.join(__dirname, '..', 'log');

// export const logLengthThreshold = Infinity; // 2000
// export const replaceForTooLongLog = '<--- Too long, omitted --->';

const defaultTendermintPort = 45000;

export const tendermintIp =
  process.env.TENDERMINT_IP == null ? 'localhost' : process.env.TENDERMINT_IP;

export const tendermintPort =
  process.env.TENDERMINT_PORT == null
    ? defaultTendermintPort
    : process.env.TENDERMINT_PORT;

export const tendermintAddress = `${tendermintIp}:${tendermintPort}`;

export const tendermintBaseHttpUrl = `http://${tendermintIp}:${tendermintPort}`;

export const tendermintBaseWsUrl = `ws://${tendermintIp}:${tendermintPort}`;

export const tendermintWsConnections = process.env.TENDERMINT_WS_CONNECTIONS
  ? parseInt(process.env.TENDERMINT_WS_CONNECTIONS)
  : 10;

export const nodeId = process.env.NODE_ID;

export const ndidNode = process.env.NDID_NODE === 'true';

const defaultMqBindingPort = 5555;

export const mqIp = process.env.MQ_CONTACT_IP || 'localhost';
export const mqPort = process.env.MQ_BINDING_PORT
  ? parseInt(process.env.MQ_BINDING_PORT)
  : defaultMqBindingPort;

export const mqServiceServerIp =
  process.env.MQ_SERVICE_SERVER_IP || 'localhost';
export const mqServiceServerPort = process.env.MQ_SERVICE_SERVER_PORT
  ? parseInt(process.env.MQ_SERVICE_SERVER_PORT)
  : 50051;

export const registerMqAtStartup =
  process.env.REGISTER_MQ_AT_STARTUP != null
    ? process.env.REGISTER_MQ_AT_STARTUP === 'true'
    : true;

export const compressMqMessage = process.env.COMPRESS_MQ_MESSAGE === 'true';

// in bytes
export const mqMessageCompressMinLength =
  process.env.MQ_MESSAGE_COMPRESS_MIN_LENGTH != null
    ? process.env.MQ_MESSAGE_COMPRESS_MIN_LENGTH
    : 1000;

// in bytes
export const mqMessageMaxUncompressedLength = 25 * 1024 * 1024; // 25 MB
// in bytes
export const mqMessageMaxLength = 3125 * 1024; // ~3 MB

export const useExternalCryptoService =
  process.env.USE_EXTERNAL_CRYPTO_SERVICE === 'true';

export const privateKeyPath = useExternalCryptoService
  ? null
  : process.env.PRIVATE_KEY_PATH == null && env === 'development'
  ? path.join(__dirname, '..', 'dev_key', 'keys', nodeId)
  : process.env.PRIVATE_KEY_PATH;
export const privateKeyPassphrase = useExternalCryptoService
  ? null
  : process.env.PRIVATE_KEY_PASSPHRASE;

export const masterPrivateKeyPath = useExternalCryptoService
  ? null
  : process.env.MASTER_PRIVATE_KEY_PATH == null && env === 'development'
  ? path.join(__dirname, '..', 'dev_key', 'master_keys', nodeId + '_master')
  : process.env.MASTER_PRIVATE_KEY_PATH;
export const masterPrivateKeyPassphrase = useExternalCryptoService
  ? null
  : process.env.MASTER_PRIVATE_KEY_PASSPHRASE;

export const nodeBehindProxyPrivateKeyDirectoryPath = useExternalCryptoService
  ? null
  : process.env.NODE_BEHIND_PROXY_PRIVATE_KEY_DIRECTORY_PATH == null &&
    env === 'development'
  ? path.join(__dirname, '..', 'dev_key', 'behind_proxy', 'keys')
  : process.env.NODE_BEHIND_PROXY_PRIVATE_KEY_DIRECTORY_PATH;
export const nodeBehindProxyMasterPrivateKeyDirectoryPath =
  useExternalCryptoService
    ? null
    : process.env.NODE_BEHIND_PROXY_MASTER_PRIVATE_KEY_DIRECTORY_PATH == null &&
      env === 'development'
    ? path.join(__dirname, '..', 'dev_key', 'behind_proxy', 'master_keys')
    : process.env.NODE_BEHIND_PROXY_MASTER_PRIVATE_KEY_DIRECTORY_PATH;

export const autoCloseRequestOnCompleted =
  process.env.AUTO_CLOSE_REQUEST_ON_COMPLETED != null
    ? process.env.AUTO_CLOSE_REQUEST_ON_COMPLETED === 'true'
    : true;
export const autoCloseRequestOnRejected =
  process.env.AUTO_CLOSE_REQUEST_ON_REJECTED != null
    ? process.env.AUTO_CLOSE_REQUEST_ON_REJECTED === 'true'
    : false;
export const autoCloseRequestOnComplicated =
  process.env.AUTO_CLOSE_REQUEST_ON_COMPLICATED != null
    ? process.env.AUTO_CLOSE_REQUEST_ON_COMPLICATED === 'true'
    : false;
export const autoCloseRequestOnErrored =
  process.env.AUTO_CLOSE_REQUEST_ON_ERRORED != null
    ? process.env.AUTO_CLOSE_REQUEST_ON_ERRORED === 'true'
    : true;

// in bytes
export const saltLength = 32;

export const saltStrLength = 44; // base64 string length of 32 bytes
export const messageStrLength = 1024;
export const purposeStrLength = 512;

// in bytes
export const asDataCompressMinLength =
  process.env.AS_DATA_COMPRESS_MIN_LENGTH != null
    ? process.env.AS_DATA_COMPRESS_MIN_LENGTH
    : 1000;

// in bytes
export const asDataMaxUncompressedLength = 10 * 1024 * 1024; // 10 MB
// in bytes
export const asDataMaxLength = 3 * 1024 * 1024; // 3 MB

// Callback retry timeout in seconds
export const callbackRetryTimeout = process.env.CALLBACK_RETRY_TIMEOUT
  ? parseInt(process.env.CALLBACK_RETRY_TIMEOUT)
  : 600;

export const maxIntervalTendermintSyncCheck = process.env
  .MAX_INTERVAL_TENDERMINT_SYNC_CHECK
  ? parseInt(process.env.MAX_INTERVAL_TENDERMINT_SYNC_CHECK)
  : 15000;

export const mode = process.env.MODE
  ? process.env.MODE.toLowerCase()
  : 'standalone';
export const masterServerPort = process.env.MASTER_SERVER_PORT || 7000;
export const masterServerIp = process.env.MASTER_SERVER_IP || 'localhost';
export const callToMasterRetryTimeout =
  process.env.CALL_TO_MASTER_RETRY_TIMEOUT_MS || 120000;

export const grpcPingInterval = process.env.GRPC_PING_INTERVAL_MS
  ? parseInt(process.env.GRPC_PING_INTERVAL_MS)
  : 60000;

export const grpcPingTimeout = process.env.GRPC_PING_TIMEOUT_MS
  ? parseInt(process.env.GRPC_PING_TIMEOUT_MS)
  : 20000;

export const grpcExpectedClientPingInterval = process.env
  .GRPC_EXPECTED_CLIENT_PING_INTERVAL_MS
  ? parseInt(process.env.GRPC_EXPECTED_CLIENT_PING_INTERVAL_MS)
  : 30000;

export const grpcCallTimeout = process.env.GRPC_CALL_TIMEOUT_MS
  ? parseInt(process.env.GRPC_CALL_TIMEOUT_MS)
  : 60000;

export const grpcSsl = process.env.GRPC_SSL === 'true';

export const grpcSslRootCertFilePath = process.env.GRPC_SSL_ROOT_CERT_FILE_PATH
  ? process.env.GRPC_SSL_ROOT_CERT_FILE_PATH
  : env === 'development'
  ? path.join(__dirname, '..', '..', 'dev_cert', 'grpc', 'ca.crt')
  : null;

export const grpcSslKeyFilePath = process.env.GRPC_SSL_KEY_FILE_PATH
  ? process.env.GRPC_SSL_KEY_FILE_PATH
  : env === 'development'
  ? path.join(
      __dirname,
      '..',
      '..',
      'dev_cert',
      'grpc',
      mode === 'worker' ? 'client.key' : 'server.key'
    )
  : null;

export const grpcSslCertFilePath = process.env.GRPC_SSL_CERT_FILE_PATH
  ? process.env.GRPC_SSL_CERT_FILE_PATH
  : env === 'development'
  ? path.join(
      __dirname,
      '..',
      '..',
      'dev_cert',
      'grpc',
      mode === 'worker' ? 'client.crt' : 'server.crt'
    )
  : null;

export const enableConfigHttpRoutePath =
  process.env.ENABLE_CONFIG_HTTP_ROUTE_PATH === 'true';

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

export const telemetryLoggingEnabled = process.env.ENABLE_TELEMETRY_LOGGING
  ? process.env.ENABLE_TELEMETRY_LOGGING === 'true'
  : true;
export const telemetryDbHost =
  (process.env.TELEMETRY_DB_HOST
    ? process.env.TELEMETRY_DB_HOST
    : process.env.TELEMETRY_DB_IP) || dbIp;
export const telemetryDbPort = process.env.TELEMETRY_DB_PORT || dbPort;
export const telemetryDbPassword =
  process.env.TELEMETRY_DB_PASSWORD || dbPassword;
export const telemetryTokenGenerationIntervalSec =
  process.env.TELEMETRY_TOKEN_TIMEOUT || 6 * 60 * 60; // also used as token expire duration
