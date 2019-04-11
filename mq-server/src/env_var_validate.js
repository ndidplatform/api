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

if (
  process.env.LOG_LEVEL != null &&
  process.env.LOG_LEVEL !== 'fatal' &&
  process.env.LOG_LEVEL !== 'error' &&
  process.env.LOG_LEVEL !== 'warn' &&
  process.env.LOG_LEVEL !== 'info' &&
  process.env.LOG_LEVEL !== 'debug' &&
  process.env.LOG_LEVEL !== 'trace'
) {
  console.error(
    'ERROR:',
    'Unsupported "LOG_LEVEL" environment variable value. Only "fatal", "error", "warn", "info", "debug", and "trace" are allowed. Process will now exit.'
  );
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  if (
    process.env.PROMETHEUS_HTTPS === 'true' &&
    (!process.env.PROMETHEUS_HTTPS_KEY_PATH ||
      !process.env.PROMETHEUS_HTTPS_CERT_PATH)
  ) {
    console.error(
      'ERROR:',
      '"PROMETHEUS_HTTPS_KEY_PATH" and "PROMETHEUS_HTTPS_CERT_PATH" environment variables are not set when "PROMETHEUS_HTTPS" is set to true. Process will now exit.'
    );
    process.exit(1);
  }

  if (
    process.env.GRPC_SSL === 'true' &&
    (!process.env.GRPC_SSL_ROOT_CERT_FILE_PATH ||
      !process.env.GRPC_SSL_KEY_FILE_PATH ||
      !process.env.GRPC_SSL_CERT_FILE_PATH)
  ) {
    console.error(
      'ERROR:',
      '"GRPC_SSL_ROOT_CERT_FILE_PATH", "GRPC_SSL_KEY_FILE_PATH", and "GRPC_SSL_CERT_FILE_PATH" environment variables are not set when "GRPC_SSL" is set to true. Process will now exit.'
    );
    process.exit(1);
  }
}
