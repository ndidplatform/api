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
    : path.join(__dirname, '..', 'devHttpsKey', 'key.pem');
export const httpsCertPath =
  process.env.HTTPS_CERT_PATH != null
    ? process.env.HTTPS_CERT_PATH
    : path.join(__dirname, '..', 'devHttpsKey', 'cert.pem');

export const clientHttpErrorCode = process.env.CLIENT_HTTP_ERROR_CODE || 400;
export const serverHttpErrorCode = process.env.SERVER_HTTP_ERROR_CODE || 500;

export const dataDirectoryPath =
  process.env.DATA_DIRECTORY_PATH || path.join(__dirname, '..', 'data');

export const logLevel =
  process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info');
export const logTarget =
  process.env.LOG_TARGET || (env === 'development' ? 'console' : 'file');
export const logColor =
  process.env.LOG_COLOR == null
    ? logTarget === 'console'
      ? true
      : false
    : process.env.LOG_COLOR === 'true';
export const logDirectoryPath =
  process.env.LOG_DIRECTORY_PATH || path.join(__dirname, '..', 'log');

export const role = process.env.ROLE;

export const defaultMqBindingPort = (() => {
  if (process.env.ROLE === 'idp') return 5555;
  if (process.env.ROLE === 'rp') return 5556;
  if (process.env.ROLE === 'as') return 5557;
  else return 5555;
})();

export const defaultTendermintPort = (() => {
  if (process.env.ROLE === 'idp' || process.env.ROLE === 'ndid') return '45000';
  if (process.env.ROLE === 'rp') return '45001';
  if (process.env.ROLE === 'as') return '45002';
  else return '45000';
})();

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

export const mqRegister = {
  ip: process.env.MQ_CONTACT_IP || 'localhost',
  port:
    process.env.MQ_BINDING_PORT == null
      ? defaultMqBindingPort
      : parseInt(process.env.MQ_BINDING_PORT),
};

export const registerMqAtStartup =
  process.env.REGISTER_MQ_AT_STARTUP != null
    ? process.env.REGISTER_MQ_AT_STARTUP === 'true'
    : role === 'ndid'
      ? false
      : true;

export const useExternalCryptoService =
  process.env.USE_EXTERNAL_CRYPTO_SERVICE === 'true';

export const privateKeyPath = useExternalCryptoService
  ? null
  : process.env.PRIVATE_KEY_PATH == null
    ? path.join(__dirname, '..', 'devKey', role, nodeId)
    : process.env.PRIVATE_KEY_PATH;
export const privateKeyPassphrase = useExternalCryptoService
  ? null
  : process.env.PRIVATE_KEY_PASSPHRASE;

export const masterPrivateKeyPath = useExternalCryptoService
  ? null
  : process.env.MASTER_PRIVATE_KEY_PATH == null
    ? path.join(__dirname, '..', 'devKey', role, nodeId + '_master')
    : process.env.MASTER_PRIVATE_KEY_PATH;
export const masterPrivateKeyPassphrase = useExternalCryptoService
  ? null
  : process.env.MASTER_PRIVATE_KEY_PASSPHRASE;

//in byte
export const challengeLength = 2;
export const zkRandomLengthForIdp = 128;

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

// Callback retry timeout in seconds
export const callbackRetryTimeout =
  process.env.CALLBACK_RETRY_TIMEOUT == null
    ? 600
    : parseInt(process.env.CALLBACK_RETRY_TIMEOUT);
