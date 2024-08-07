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

import fs from 'fs';
import crypto from 'crypto';

// import BN from 'bn.js';
import { toBigIntBE, toBufferBE } from 'bigint-buffer';

import * as cryptoUtils from './crypto';
import { parseKey, encodeSignature } from './asn1parser';
import * as nodeKey from './node_key';
import * as externalCryptoService from '../external_crypto_service';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import logger from '../logger';
import * as tendermintNdid from '../tendermint/ndid';

import * as config from '../config';

export async function hasSeenChain(chainIdToCheck) {
  let chainHistory = await tendermintNdid.getChainHistory();
  let chainIdList = chainHistory.chains.map(({ chain_id }) => chain_id);
  return chainIdList.indexOf(chainIdToCheck) !== -1;
}

export function wait(ms, stoppable) {
  let setTimeoutFn;
  const promise = new Promise(
    (resolve) => (setTimeoutFn = setTimeout(resolve, ms))
  );
  if (stoppable) {
    return Object.assign(promise, { stop: () => clearTimeout(setTimeoutFn) });
  }
  return promise;
}

export function readFileAsync(path, opts) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, opts, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

export function randomBase64Bytes(length) {
  return cryptoUtils.randomBase64Bytes(length);
}

export function randomBufferBytes(length) {
  return crypto.randomBytes(length);
}

export function getNonce() {
  return randomBufferBytes(32);
}

export function hash(hashAlgorithm, dataToHash) {
  let hashBuffer;

  if (hashAlgorithm === cryptoUtils.hashAlgorithm.SHA256) {
    hashBuffer = cryptoUtils.sha256(dataToHash);
  } else if (hashAlgorithm === cryptoUtils.hashAlgorithm.SHA384) {
    hashBuffer = cryptoUtils.sha384(dataToHash);
  } else if (hashAlgorithm === cryptoUtils.hashAlgorithm.SHA512) {
    hashBuffer = cryptoUtils.sha512(dataToHash);
  }

  return hashBuffer.toString('base64');
}

export async function decryptAsymetricKey(
  nodeId,
  algorithm,
  keyVersion,
  encryptedSymKey,
  encryptedMessage
) {
  const encAlg = cryptoUtils.encryptionAlgorithm[algorithm];
  if (encAlg == null) {
    throw new Error('unknown/unsupported algorithm');
  }

  let symKeyBuffer;
  if (config.useExternalCryptoService) {
    symKeyBuffer = await externalCryptoService.decryptAsymetricKey(
      nodeId,
      encAlg,
      keyVersion,
      encryptedSymKey.toString('base64')
    );
  } else {
    const key = nodeKey.getLocalNodeEncryptionPrivateKey(nodeId);
    const passphrase =
      nodeKey.getLocalNodeEncryptionPrivateKeyPassphrase(nodeId);

    symKeyBuffer = cryptoUtils.privateDecrypt(
      {
        key,
        passphrase,
        padding: encAlg.padding,
        oaepHash: encAlg.oaepHash,
      },
      encryptedSymKey
    );
  }

  return cryptoUtils.decryptAES256GCM(symKeyBuffer, encryptedMessage, false);
}

export function encryptAsymetricKey(algorithm, publicKey, messageBuffer) {
  const encAlg = cryptoUtils.encryptionAlgorithm[algorithm];
  if (encAlg == null) {
    throw new Error('unknown/unsupported algorithm');
  }

  const symKeyBuffer = crypto.randomBytes(32);
  const encryptedSymKey = cryptoUtils.publicEncrypt(
    {
      key: publicKey,
      padding: encAlg.padding,
      oaepHash: encAlg.oaepHash,
    },
    symKeyBuffer
  );
  const encryptedMessage = cryptoUtils.encryptAES256GCM(
    symKeyBuffer,
    messageBuffer,
    false // Key derivation is not needed since key is cryptographically random generated and use only once
  );
  return {
    encryptedSymKey,
    encryptedMessage,
  };
}

export function extractPaddingFromPrivateEncrypt(cipher, publicKey) {
  let rawMessageBuffer;
  try {
    rawMessageBuffer = cryptoUtils.publicDecrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_NO_PADDING,
      },
      Buffer.from(cipher, 'base64')
    );
  } catch (error) {
    throw new CustomError({
      errorType: errorType.INVALID_SECRET,
    });
  }

  //RSA PKCS v. 1.5
  if (
    rawMessageBuffer[0] !== 0 ||
    (rawMessageBuffer[1] !== 0 && rawMessageBuffer[1] !== 1)
  ) {
    throw new CustomError({
      errorType: errorType.INVALID_SECRET,
    });
  }
  let padLength = 2;
  while (rawMessageBuffer[padLength] !== 0) padLength++;

  logger.debug({
    message: 'padding extracted',
    publicKey,
    rawMessageBuffer,
    rawMessageString: rawMessageBuffer.toString('base64'),
    hash_id_string: rawMessageBuffer.slice(padLength).toString('base64'),
    padLength,
  });

  return rawMessageBuffer.slice(0, padLength + 1).toString('base64');
}

/**
 *
 * @param {string} algorithm
 * @param {number} keyVersion
 * @param {string|Buffer} messageToSign
 * @param {string} nodeId
 * @param {boolean} useMasterKey
 * @return {Buffer} signature
 */
export async function createSignature(
  algorithm,
  keyVersion,
  messageToSign,
  nodeId,
  useMasterKey
) {
  if (typeof messageToSign === 'string') {
    messageToSign = Buffer.from(messageToSign, 'utf8');
  }
  if (!Buffer.isBuffer(messageToSign)) {
    throw new CustomError({
      message: 'Expected message to sign to be a Buffer',
    });
  }

  const sigAlg = cryptoUtils.signatureAlgorithm[algorithm];
  if (sigAlg == null) {
    throw new Error('unknown/unsupported algorithm');
  }

  let messageToSignHash;
  if (sigAlg.hashAlgorithm != null) {
    messageToSignHash = hash(sigAlg.hashAlgorithm, messageToSign);
  } else {
    messageToSignHash = null;
  }

  if (config.useExternalCryptoService) {
    return await externalCryptoService.createSignature(
      sigAlg,
      keyVersion,
      messageToSign.toString('base64'),
      messageToSignHash,
      nodeId,
      useMasterKey
    );
  }

  const key = useMasterKey
    ? nodeKey.getLocalNodeSigningMasterPrivateKey(nodeId)
    : nodeKey.getLocalNodeSigningPrivateKey(nodeId);
  const passphrase = useMasterKey
    ? nodeKey.getLocalNodeSigningMasterPrivateKeyPassphrase(nodeId)
    : nodeKey.getLocalNodeSigningPrivateKeyPassphrase(nodeId);

  return cryptoUtils.createSignature(algorithm, messageToSign, {
    key,
    passphrase,
    padding: sigAlg.padding,
  });
}

/**
 *
 * @param {string} algorithm
 * @param {string|Buffer} signature
 * @param {string|Buffer} publicKey
 * @param {string|Buffer} message
 */
export function verifySignature(algorithm, signature, publicKey, message) {
  if (!Buffer.isBuffer(signature)) {
    signature = Buffer.from(signature, 'base64');
  }
  if (!Buffer.isBuffer(message)) {
    message = Buffer.from(message, 'utf8');
  }

  const sigAlg = cryptoUtils.signatureAlgorithm[algorithm];
  if (sigAlg == null) {
    throw new Error('unknown/unsupported algorithm');
  }

  return cryptoUtils.verifySignature(
    algorithm,
    signature,
    {
      key: publicKey,
      padding: sigAlg.padding,
    },
    message
  );
}

function getDataHashWithCustomPadding(
  initialSalt,
  keyModulus,
  dataHash,
  blockLengthBits = 2048
) {
  const hashLength = 256;
  const padLengthInbyte = parseInt(
    Math.floor((blockLengthBits - hashLength) / 8)
  );
  let paddingBuffer = Buffer.alloc(0);

  for (
    let i = 1;
    paddingBuffer.length + config.saltLength <= padLengthInbyte;
    i++
  ) {
    paddingBuffer = Buffer.concat([
      paddingBuffer,
      cryptoUtils
        .sha256(initialSalt + i.toString())
        .slice(0, config.saltLength),
    ]);
  }

  const hashWithPaddingBeforeMod = Buffer.concat([paddingBuffer, dataHash]);

  const hashWithPaddingBN = toBigIntBE(hashWithPaddingBeforeMod);
  const keyModulusBN = toBigIntBE(keyModulus);

  const hashWithPaddingModKeyModulusBN = hashWithPaddingBN % keyModulusBN;
  const hashWithPadding = toBufferBE(
    hashWithPaddingModKeyModulusBN,
    blockLengthBits / 8
  ); // Zeros padded in-front

  // const hashWithPaddingBN = new BN(hashWithPaddingBeforeMod);
  // const keyModulusBN = new BN(keyModulus);

  // let hashWithPadding = hashWithPaddingBN.mod(keyModulusBN).toBuffer();
  // if (hashWithPadding.length < keyModulus.length) {
  //   const zeros = Buffer.alloc(keyModulus.length - hashWithPadding.length);
  //   hashWithPadding = Buffer.concat([zeros, hashWithPadding]);
  // }

  return hashWithPadding;
}

export function hashRequestMessageForConsent(
  request_message,
  initial_salt,
  request_id,
  accessorPublicKey
) {
  const parsedKey = parseKey(accessorPublicKey);
  const keyModulus = parsedKey.data.modulus.toBuffer();

  const derivedSalt = cryptoUtils
    .sha256(request_id + initial_salt)
    .slice(0, config.saltLength)
    .toString('base64');

  const normalHashBuffer = cryptoUtils.sha256(request_message + derivedSalt);

  //should find block length if use another sign method
  const hashWithPadding = getDataHashWithCustomPadding(
    initial_salt,
    keyModulus,
    normalHashBuffer
  );

  return hashWithPadding.toString('base64');
}

export function verifyResponseSignature(
  signature,
  publicKey,
  request_message,
  initial_salt,
  request_id
) {
  let decryptedSignatureBase64;
  try {
    decryptedSignatureBase64 = cryptoUtils
      .publicDecrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        Buffer.from(signature, 'base64')
      )
      .toString('base64');
  } catch (error) {
    if (error.code === 'ERR_OSSL_RSA_DATA_TOO_LARGE_FOR_MODULUS') {
      return false;
    }
    throw error;
  }

  const hashWithPaddingBase64 = hashRequestMessageForConsent(
    request_message,
    initial_salt,
    request_id,
    publicKey
  );

  return hashWithPaddingBase64 === decryptedSignatureBase64;
}

export function createRequestId() {
  return cryptoUtils.randomHexBytes(32);
}

export function generateRequestMessageSalt({
  initial_salt,
  namespace,
  identifier,
}) {
  const bufferHash = cryptoUtils.sha256(namespace + identifier + initial_salt);
  return bufferHash.slice(0, config.saltLength).toString('base64');
}

export function generateRequestParamSalt({
  request_id,
  service_id,
  initial_salt,
}) {
  const bufferHash = cryptoUtils.sha256(request_id + service_id + initial_salt);
  return bufferHash.slice(0, config.saltLength).toString('base64');
}

export function generateDataSalt({ request_id, service_id, initial_salt }) {
  const bufferHash = cryptoUtils.sha256(
    request_id + service_id + config.nodeId + initial_salt
  );
  return bufferHash.slice(0, config.saltLength).toString('base64');
}

export function createMessageId() {
  return cryptoUtils.randomHexBytes(32);
}

export function generateMessageSalt(initial_salt) {
  const bufferHash = cryptoUtils.sha256(initial_salt);
  return bufferHash.slice(0, config.saltLength).toString('base64');
}

/**
 * @typedef {Object} RequestStatus
 * @property {string} request_id
 * @property {string} status
 * @property {number} min_idp
 * @property {number} answered_idp_count
 * @property {boolean} closed
 * @property {boolean} timed_out
 * @property {Object} service_list
 * @property {string} service_list.service_id
 * @property {number} service_list.min_as
 * @property {number} service_list.signed_data_count
 * @property {number} service_list.received_data_count
 */
/**
 * Get request status for API v5
 *
 * @param {Object} requestDetail
 * @param {string} requestDetail.request_id
 * @param {number} requestDetail.min_idp
 * @param {number} requestDetail.min_ial
 * @param {number} requestDetail.min_aal
 * @param {number} requestDetail.request_timeout
 * @param {Array.<Object>} requestDetail.data_request_list
 * @param {string} requestDetail.request_message_hash
 * @param {Array.<Object>} requestDetail.response_list
 * @param {boolean} requestDetail.closed
 * @param {boolean} requestDetail.timed_out
 * @returns {string} requestStatus
 */
export function getRequestStatus(requestDetail) {
  if (requestDetail.data_request_list == null) {
    requestDetail.data_request_list = [];
  }
  if (requestDetail.response_list == null) {
    requestDetail.response_list = [];
  }

  let status;
  if (requestDetail.response_list.length === 0) {
    status = 'pending';
  }
  // Check response's status
  const responseCount = requestDetail.response_list.reduce(
    (count, response) => {
      if (response.status === 'accept') {
        count.accept++;
      } else if (response.status === 'reject') {
        count.reject++;
      } else if (response.error_code != null) {
        count.error++;
      }
      return count;
    },
    {
      accept: 0,
      reject: 0,
      error: 0,
    }
  );
  if (
    responseCount.error >
    requestDetail.idp_id_list.length - requestDetail.min_idp
  ) {
    // request can never be fulfilled
    status = 'errored';
    return status;
  } else {
    if (responseCount.accept > 0 && responseCount.reject === 0) {
      status = 'confirmed';
    } else if (responseCount.accept === 0 && responseCount.reject > 0) {
      status = 'rejected';
    } else if (responseCount.accept > 0 && responseCount.reject > 0) {
      status = 'complicated';
    } else if (
      responseCount.accept === 0 &&
      responseCount.reject === 0 &&
      responseCount.error > 0
    ) {
      status = 'pending';
    }
  }

  if (requestDetail.data_request_list.length === 0) {
    // No data request
    const nonErrorAnsweredIdPCount = requestDetail.response_list.filter(
      (response) => response.error_code == null
    ).length;
    if (nonErrorAnsweredIdPCount === requestDetail.min_idp) {
      if (
        responseCount.reject === 0 &&
        (responseCount.accept > 0 ||
          (responseCount.accept === 0 &&
            ['RegisterIdentity', 'AddAccessor', 'RevokeAccessor'].includes(
              requestDetail.purpose
            )))
      ) {
        status = 'completed';
      }
    }
  } else {
    let hasDataReponse = false;

    const dataResponseSummary = [];
    let hasZeroMinAsCase = false;

    for (let i = 0; i < requestDetail.data_request_list.length; i++) {
      const service = requestDetail.data_request_list[i];

      if (service.min_as === 0) {
        hasZeroMinAsCase = true;
      }

      if (service.response_list.length > 0) {
        hasDataReponse = true;
      }

      const responseCount = service.response_list.reduce(
        (count, response) => {
          if (response.error_code != null) {
            count.error++;
          } else {
            if (response.signed) {
              count.signed++;
            }
            if (response.received_data) {
              count.receivedData++;
            }
            if (response.signed && response.received_data) {
              count.signedAndReceivedData++;
            }
          }
          return count;
        },
        {
          signed: 0,
          receivedData: 0,
          signedAndReceivedData: 0,
          error: 0,
        }
      );

      dataResponseSummary.push({
        minAs: service.min_as,
        eligibleAs: service.as_id_list.length,
        ...responseCount,
      });
    }

    if (!hasDataReponse) {
      return status;
    }

    if (hasZeroMinAsCase) {
      let allSuccess;
      let someSuccess = false;
      let allError;
      let canWaitForMoreResponse = false;
      for (let i = 0; i < dataResponseSummary.length; i++) {
        const { minAs, eligibleAs, signedAndReceivedData, error } =
          dataResponseSummary[i];

        if (minAs > 0) {
          if (error > eligibleAs - minAs) {
            allSuccess = allSuccess == null ? false : allSuccess && false;
            allError = allError == null ? true : allError && true;
            continue;
          }

          if (minAs === signedAndReceivedData) {
            allSuccess = allSuccess == null ? true : allSuccess && true;
            allError = allError == null ? false : allError && false;
            someSuccess = someSuccess || true;
            continue;
          }

          allSuccess = allSuccess == null ? false : allSuccess && false;
          canWaitForMoreResponse = canWaitForMoreResponse || true;
        } else {
          if (eligibleAs > error) {
            canWaitForMoreResponse = canWaitForMoreResponse || true;
          }

          if (signedAndReceivedData > 0) {
            someSuccess = someSuccess || true;
            allError = allError == null ? false : allError && false;
          }

          if (eligibleAs === signedAndReceivedData) {
            allSuccess = allSuccess == null ? true : allSuccess && true;
            allError = allError == null ? false : allError && false;
            continue;
          }

          if (eligibleAs === error) {
            allSuccess = allSuccess == null ? false : allSuccess && false;
            allError = allError == null ? true : allError && true;
            continue;
          }

          allSuccess = allSuccess == null ? false : allSuccess && false;
        }
      }

      if (allError != null && allError) {
        if (!canWaitForMoreResponse) {
          status = 'errored';
        }
      } else if (allSuccess != null && allSuccess) {
        status = 'completed';
      } else if (someSuccess) {
        status = 'partial_completed';
      }
    } else {
      let allSuccess;
      for (let i = 0; i < dataResponseSummary.length; i++) {
        const { minAs, eligibleAs, signedAndReceivedData, error } =
          dataResponseSummary[i];

        if (error > eligibleAs - minAs) {
          // request can never be fulfilled
          status = 'errored';
          return status;
        }

        if (minAs === signedAndReceivedData) {
          allSuccess = allSuccess == null ? true : allSuccess && true;
          continue;
        }

        allSuccess = allSuccess == null ? false : allSuccess && false;
      }

      if (allSuccess != null && allSuccess) {
        status = 'completed';
      }
    }
  }

  return status;
}

/**
 * Get detailed request status for API v4
 *
 * @param {Object} requestDetail
 * @param {string} requestDetail.request_id
 * @param {number} requestDetail.min_idp
 * @param {number} requestDetail.min_ial
 * @param {number} requestDetail.min_aal
 * @param {number} requestDetail.request_timeout
 * @param {Array.<Object>} requestDetail.data_request_list
 * @param {string} requestDetail.request_message_hash
 * @param {Array.<Object>} requestDetail.response_list
 * @param {boolean} requestDetail.closed
 * @param {boolean} requestDetail.timed_out
 * @returns {RequestStatus} requestStatus
 */
export function getDetailedRequestStatusLegacy(requestDetail) {
  if (requestDetail.data_request_list == null) {
    requestDetail.data_request_list = [];
  }
  if (requestDetail.response_list == null) {
    requestDetail.response_list = [];
  }

  let status;
  if (requestDetail.response_list.length === 0) {
    status = 'pending';
  }
  // Check response's status
  const responseCount = requestDetail.response_list.reduce(
    (count, response) => {
      if (response.status === 'accept') {
        count.accept++;
      } else if (response.status === 'reject') {
        count.reject++;
      }
      return count;
    },
    {
      accept: 0,
      reject: 0,
    }
  );
  if (responseCount.accept > 0 && responseCount.reject === 0) {
    status = 'confirmed';
  } else if (responseCount.accept === 0 && responseCount.reject > 0) {
    status = 'rejected';
  } else if (responseCount.accept > 0 && responseCount.reject > 0) {
    status = 'complicated';
  } else if (responseCount.accept === 0 && responseCount.reject === 0) {
    // support error response
    status = 'pending';
  }

  const serviceList = requestDetail.data_request_list.map((service) => {
    const signedAnswerCount =
      service.response_list != null
        ? service.response_list.filter((response) => response.signed === true)
            .length
        : 0;
    const receivedDataCount =
      service.response_list != null
        ? service.response_list.filter(
            (response) => response.received_data === true
          ).length
        : 0;
    return {
      service_id: service.service_id,
      min_as: service.min_as,
      signed_data_count: signedAnswerCount,
      received_data_count: receivedDataCount,
    };
  });

  if (requestDetail.data_request_list.length === 0) {
    // No data request
    const nonErrorAnsweredIdPCount = requestDetail.response_list.filter(
      (response) => response.error_code == null
    ).length;
    if (nonErrorAnsweredIdPCount === requestDetail.min_idp) {
      if (
        responseCount.reject === 0 &&
        (responseCount.accept > 0 ||
          (responseCount.accept === 0 &&
            ['RegisterIdentity', 'AddAccessor', 'RevokeAccessor'].includes(
              requestDetail.purpose
            )))
      ) {
        status = 'completed';
      }
    }
  } else if (requestDetail.data_request_list.length > 0) {
    const asSignedAnswerCount = serviceList.reduce(
      (total, service) => ({
        count: total.count + service.min_as,
        signedAnswerCount: total.signedAnswerCount + service.signed_data_count,
        receivedDataCount:
          total.receivedDataCount + service.received_data_count,
      }),
      {
        count: 0,
        signedAnswerCount: 0,
        receivedDataCount: 0,
      }
    );

    if (
      asSignedAnswerCount.count === asSignedAnswerCount.signedAnswerCount &&
      asSignedAnswerCount.signedAnswerCount ===
        asSignedAnswerCount.receivedDataCount
    ) {
      status = 'completed';
    }
  }
  return {
    mode: requestDetail.mode,
    request_id: requestDetail.request_id,
    status,
    min_idp: requestDetail.min_idp,
    answered_idp_count: requestDetail.response_list.length,
    closed: requestDetail.closed,
    timed_out: requestDetail.timed_out,
    service_list: serviceList,
  };
}
