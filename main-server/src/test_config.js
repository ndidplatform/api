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

// for Your Data data decryption key retry request tests
// (RP node side)
let doNotRequestForYourDataDataDecryptionKey =
  process.env.TEST_DO_NOT_REQUEST_FOR_YOUR_DATA_DATA_DECRYPTION_KEY != null
    ? process.env.TEST_DO_NOT_REQUEST_FOR_YOUR_DATA_DATA_DECRYPTION_KEY ===
      'true'
    : false;

export function setDoNotRequestForYourDataDataDecryptionKeyConfig(value) {
  doNotRequestForYourDataDataDecryptionKey = value;
}

export function getDoNotRequestForYourDataDataDecryptionKeyConfig() {
  return doNotRequestForYourDataDataDecryptionKey;
}

// for Your Data data decryption key retry request timeout tests
// (AS node side)
let doNotProcessYourDataDataDecryptionKeyRetryRequest =
  process.env.TEST_DO_NOT_PROCESS_YOUR_DATA_DATA_DECRYPTION_KEY_RETRY_REQUEST !=
  null
    ? process.env
        .TEST_DO_NOT_PROCESS_YOUR_DATA_DATA_DECRYPTION_KEY_RETRY_REQUEST ===
      'true'
    : false;

export function setDoNotProcessYourDataDataDecryptionKeyRetryRequestConfig(
  value
) {
  doNotProcessYourDataDataDecryptionKeyRetryRequest = value;
}

export function getDoNotProcessYourDataDataDecryptionKeyRetryRequestConfig() {
  return doNotProcessYourDataDataDecryptionKeyRetryRequest;
}

export function setTestConfig(testConfig) {
  if (
    testConfig.doNotRequestForYourDataDataDecryptionKey != null &&
    typeof testConfig.doNotRequestForYourDataDataDecryptionKey === 'boolean'
  ) {
    doNotRequestForYourDataDataDecryptionKey =
      testConfig.doNotRequestForYourDataDataDecryptionKey;
  }
  if (
    testConfig.doNotProcessYourDataDataDecryptionKeyRetryRequest != null &&
    typeof testConfig.doNotProcessYourDataDataDecryptionKeyRetryRequest ===
      'boolean'
  ) {
    doNotProcessYourDataDataDecryptionKeyRetryRequest =
      testConfig.doNotProcessYourDataDataDecryptionKeyRetryRequest;
  }
}

export function getTestConfig() {
  return {
    doNotRequestForYourDataDataDecryptionKey,
    doNotProcessYourDataDataDecryptionKeyRetryRequest,
  };
}
