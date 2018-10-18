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

export const dbIp = process.env.DB_IP || 'localhost';
export const dbPort = process.env.DB_PORT || 6379;
export const dbPassword = process.env.DB_PASSWORD;

export const dataDirectoryPath =
  process.env.DATA_DIRECTORY_PATH || path.join(__dirname, '..', 'data');

export const logLevel =
  process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info');
export const logFormat = process.env.LOG_FORMAT || 'default';
export const logTarget = process.env.LOG_TARGET || 'console';
export const logColor =
  process.env.LOG_COLOR == null
    ? logTarget === 'console'
    : process.env.LOG_COLOR === 'true';
export const logOneLine = process.env.LOG_ONE_LINE === 'true';
export const logDirectoryPath =
  process.env.LOG_DIRECTORY_PATH || path.join(__dirname, '..', 'log');

export const logLengthThreshold = Infinity; // 2000
export const replaceForTooLongLog = '<--- Too long, omitted --->';

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

export const nodeId = process.env.NODE_ID;

export const skipGetRole = process.env.SKIP_GET_ROLE === 'true';

const defaultMqBindingPort = 5555;

export const mqIp = process.env.MQ_CONTACT_IP || 'localhost';
export const mqPort =
  process.env.MQ_BINDING_PORT == null
    ? defaultMqBindingPort
    : parseInt(process.env.MQ_BINDING_PORT);

export const mqServiceServerIp =
  process.env.MQ_SERVICE_SERVER_IP || 'localhost';
export const mqServiceServerPort = process.env.MQ_SERVICE_SERVER_PORT
  ? parseInt(process.env.MQ_SERVICE_SERVER_PORT)
  : 50051;

export const registerMqAtStartup =
  process.env.REGISTER_MQ_AT_STARTUP != null
    ? process.env.REGISTER_MQ_AT_STARTUP === 'true'
    : true;

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
export const nodeBehindProxyMasterPrivateKeyDirectoryPath = useExternalCryptoService
  ? null
  : process.env.NODE_BEHIND_PROXY_MASTER_PRIVATE_KEY_DIRECTORY_PATH == null &&
    env === 'development'
    ? path.join(__dirname, '..', 'dev_key', 'behind_proxy', 'master_keys')
    : process.env.NODE_BEHIND_PROXY_MASTER_PRIVATE_KEY_DIRECTORY_PATH;

//in byte
export const challengeLength = 2;
export const zkRandomLengthForIdp = 128;
export const saltLength = 16;

export const createIdentityRequestMessageTemplateFilepath =
  process.env.CREATE_IDENTITY_REQUEST_MESSAGE_TEMPLATE_PATH ||
  path.join(
    __dirname,
    '..',
    'request_message_templates',
    'create_identity.mustache'
  );

export const addAccessorRequestMessageTemplateFilepath =
  process.env.ADD_ACCESSOR_REQUEST_MESSAGE_TEMPLATE_PATH ||
  path.join(
    __dirname,
    '..',
    'request_message_templates',
    'add_accessor.mustache'
  );

export const revokeAccessorRequestMessageTemplateFilepath =
  process.env.REVOKE_ACCESSOR_REQUEST_MESSAGE_TEMPLATE_PATH ||
  path.join(
    __dirname,
    '..',
    'request_message_templates',
    'revoke_accessor.mustache'
  );

// Callback retry timeout in seconds
export const callbackRetryTimeout =
  process.env.CALLBACK_RETRY_TIMEOUT == null
    ? 600
    : parseInt(process.env.CALLBACK_RETRY_TIMEOUT);

export const maxIntervalTendermintSyncCheck = process.env
  .MAX_INTERVAL_TENDERMINT_SYNC_CHECK
  ? parseInt(process.env.MAX_INTERVAL_TENDERMINT_SYNC_CHECK)
  : 15000;
