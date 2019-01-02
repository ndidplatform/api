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

if (process.env.NODE_ENV == null || process.env.NODE_ENV === '') {
  console.warn(
    '"NODE_ENV" environment variable is not set. Default to "development"'
  );
} else {
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'test'
  ) {
    console.error(
      'ERROR:',
      'Unsupported "NODE_ENV" environment variable value. Only "development", "production", and "test" are allowed. Process will now exit.'
    );
    process.exit(1);
  }
}

if (process.env.IS_MASTER === 'true') {
  if (process.env.NODE_ID == null || process.env.NODE_ID === '') {
    console.error(
      'ERROR:',
      '"NODE_ID" environment variable is not set. Process will now exit.'
    );
    process.exit(1);
  }

  if (process.env.TENDERMINT_IP == null) {
    console.warn(
      '"TENDERMINT_IP" environment variable is not set. Default to "localhost"'
    );
  }

  if (process.env.MQ_CONTACT_IP == null) {
    console.warn(
      '"MQ_CONTACT_IP" environment variable is not set. Default to "localhost"'
    );
  }
}

if (
  process.env.LOG_LEVEL != null &&
  process.env.LOG_LEVEL !== 'error' &&
  process.env.LOG_LEVEL !== 'warn' &&
  process.env.LOG_LEVEL !== 'info' &&
  process.env.LOG_LEVEL !== 'verbose' &&
  process.env.LOG_LEVEL !== 'debug' &&
  process.env.LOG_LEVEL !== 'silly'
) {
  console.error(
    'ERROR:',
    'Unsupported "LOG_LEVEL" environment variable value. Only "error", "warn", "info", "verbose", "debug", and "silly" are allowed. Process will now exit.'
  );
  process.exit(1);
}

if (
  process.env.LOG_TARGET != null &&
  process.env.LOG_TARGET !== 'console' &&
  process.env.LOG_TARGET !== 'file'
) {
  console.error(
    'ERROR:',
    'Unsupported "LOG_TARGET" environment variable value. Only "console" and "file" are allowed. Process will now exit.'
  );
  process.exit(1);
}

if (process.env.LOG_TARGET === 'file') {
  if (process.env.LOG_DIRECTORY_PATH == null) {
    console.warn(
      `"LOG_DIRECTORY_PATH" environment variable is not set. Default to "${path.join(
        __dirname,
        '..',
        'log'
      )}"`
    );
  }
}

if (process.env.NODE_ENV === 'production') {
  if (
    process.env.USE_EXTERNAL_CRYPTO_SERVICE !== 'true' &&
    (process.env.PRIVATE_KEY_PATH == null ||
      process.env.MASTER_PRIVATE_KEY_PATH == null)
  ) {
    console.error(
      'ERROR:',
      '"PRIVATE_KEY_PATH" and/or "MASTER_PRIVATE_KEY_PATH" environment variables are not set. Process will now exit.'
    );
    process.exit(1);
  }

  if (
    process.env.HTTPS === 'true' &&
    (!process.env.HTTPS_KEY_PATH || !process.env.HTTPS_CERT_PATH)
  ) {
    console.error(
      'ERROR:',
      '"HTTPS_KEY_PATH" and "HTTPS_CERT_PATH" environment variables are not set when "HTTPS" is set to true. Process will now exit.'
    );
    process.exit(1);
  }

  // if (
  //   process.env.ROLE === 'idp' &&
  //   process.env.CREATE_IDENTITY_REQUEST_MESSAGE_TEMPLATE_PATH == null
  // ) {
  //   console.error(
  //     'ERROR:',
  //     '"CREATE_IDENTITY_REQUEST_MESSAGE_TEMPLATE_PATH" environment variable is not set. Process will now exit.'
  //   );
  //   process.exit(1);
  // }

  // if (
  //   process.env.ROLE === 'idp' &&
  //   process.env.ADD_ACCESSOR_REQUEST_MESSAGE_TEMPLATE_PATH == null
  // ) {
  //   console.error(
  //     'ERROR:',
  //     '"ADD_ACCESSOR_REQUEST_MESSAGE_TEMPLATE_PATH" environment variable is not set. Process will now exit.'
  //   );
  //   process.exit(1);
  // }
}
