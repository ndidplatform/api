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
}

if (process.env.ROLE == null) {
  console.error(
    'ERROR:',
    '"ROLE" environment variable is not set. Process will now exit.'
  );
  process.exit(1);
}

if (
  process.env.ROLE !== 'idp' &&
  process.env.ROLE !== 'rp' &&
  process.env.ROLE !== 'as' &&
  process.env.ROLE !== 'ndid'
) {
  console.error(
    `Unknown role: ${
      process.env.ROLE
    }; Must be one of "idp", "rp", "as", or "ndid". Process will now exit.`
  );
  process.exit(1);
}

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

if (
  process.env.NODE_ENV === 'production' &&
  process.env.LOG_DIRECTORY_PATH == null
) {
  console.warn(
    `"LOG_DIRECTORY_PATH" environment variable is not set. Default to "${__dirname}"`
  );
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.USE_EXTERNAL_CRYPTO_SERVICE !== 'true' &&
  process.env.PRIVATE_KEY_PATH == null &&
  process.env.MASTER_PRIVATE_KEY_PATH == null
) {
  console.error(
    'ERROR:',
    '"PRIVATE_KEY_PATH" and "MASTER_PRIVATE_KEY_PATH" environment variables are not set. Process will now exit.'
  );
  process.exit(1);
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.HTTPS === 'true' &&
  (!process.env.HTTPS_KEY_PATH || !process.env.HTTPS_CERT_PATH)
) {
  console.error(
    'ERROR:',
    '"HTTPS_KEY_PATH" and "HTTPS_CERT_PATH" environment variables are not set when "HTTPS" is set to true. Process will now exit.'
  );
  process.exit(1);
}
