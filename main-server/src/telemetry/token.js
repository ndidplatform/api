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

import base64url from 'base64url';

import * as telemetryDb from '../db/telemetry';
import * as telemetryEventsDb from '../db/telemetry_events';
import * as node from '../node';
import * as tendermintNdid from '../tendermint/ndid';
import logger from '../logger';
import * as utils from '../utils';
import * as cryptoUtils from '../utils/crypto';
import ROLE from '../role';
import * as config from '../config';

const tokenTimeoutSec = config.telemetryTokenGenerationIntervalSec;

let tokenGenerationRetryCount = 0;
const tokenGenerationRetryLimit = 5; // 5 retries per token generation
const tokenGenerationRetryTimeoutSec = 10; // 10 seconds between each retry generation

let tokenGenerationTimeoutID;

let tokenInfo;
let role;
let managedNodeIds;

let initialized = false;

export async function initialize({ tokenInfo: _tokenInfo, role: _role } = {}) {
  tokenInfo = _tokenInfo;
  role = _role;

  if (role === ROLE.RP || role === ROLE.IDP || role === ROLE.AS) {
    managedNodeIds = [config.nodeId];
  } else if (role === ROLE.PROXY) {
    await refreshProxyManagedNodeIds();
  }

  await telemetryEventsDb.subscribeToNodeTokenDelete({
    onNewTokenRequest,
  });

  createTokenGenerationTimeout();

  initialized = true;
}

async function refreshProxyManagedNodeIds() {
  const nodesBehindProxy = await node.getNodesBehindProxyWithKeyOnProxy();
  managedNodeIds = nodesBehindProxy.map((node) => node.node_id);
}

async function onNewTokenRequest({ nodeId }) {
  if (!initialized) {
    return;
  }

  if (role === ROLE.PROXY) {
    await refreshProxyManagedNodeIds();
  }

  if (managedNodeIds.includes(nodeId)) {
    logger.info('Telemetry new token requested, generating');
    createTokenGenerationTimeout();
  }
}

const JWT_ALG = {
  RS256: 'RS256',
  RS384: 'RS384',
  RS512: 'RS512',
  PS256: 'PS256',
  PS384: 'PS384',
  PS512: 'PS512',
  ES256: 'ES256',
  ES384: 'ES384',
  ES512: 'ES512',
  ES256K: 'ES256K', // EC secp256k1
  EdDSA: 'EdDSA',
};

const signingAlgorithmMap = {
  [cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_256.name]:
    JWT_ALG.RS256,
  [cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_384.name]:
    JWT_ALG.RS384,
  [cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_512.name]:
    JWT_ALG.RS512,
  [cryptoUtils.signatureAlgorithm.RSASSA_PSS_SHA_256.name]: JWT_ALG.PS256,
  [cryptoUtils.signatureAlgorithm.RSASSA_PSS_SHA_384.name]: JWT_ALG.PS384,
  [cryptoUtils.signatureAlgorithm.RSASSA_PSS_SHA_512.name]: JWT_ALG.PS512,
  [cryptoUtils.signatureAlgorithm.ECDSA_SHA_256.name]: JWT_ALG.ES256,
  [cryptoUtils.signatureAlgorithm.ECDSA_SHA_384.name]: JWT_ALG.ES384,
  [cryptoUtils.signatureAlgorithm.Ed25519.name]: JWT_ALG.EdDSA,
};

// TOKEN Generation Module
async function createJWT({ nodeId, payload }) {
  const publicKey = await tendermintNdid.getNodeSigningPubKey(nodeId);

  const jwtAlg = signingAlgorithmMap[publicKey.algorithm];
  if (jwtAlg == null) {
    throw new Error('unsupported jwt signing algorithm');
  }
  const header = {
    type: 'JWT',
    alg: jwtAlg,
  };

  const headerJSON = JSON.stringify(header);
  const encodedHeader = base64url(headerJSON);

  const payloadJSON = JSON.stringify(payload);
  const encodedPayload = base64url(payloadJSON);

  const token = encodedHeader + '.' + encodedPayload;
  const signature = await utils.createSignature(
    publicKey.algorithm,
    publicKey.version,
    token,
    nodeId,
    false
  );

  let jwtSignature;
  if (
    [JWT_ALG.ES256, JWT_ALG.ES384, JWT_ALG.ES512, JWT_ALG.ES256K].includes(
      jwtAlg
    )
  ) {
    jwtSignature = cryptoUtils.convertEcdsaASN1SigToIEEEP1363Sig(
      publicKey.algorithm,
      signature
    );
  } else {
    jwtSignature = signature;
  }

  const signedToken = token + '.' + base64url(jwtSignature);

  return signedToken;
}

/*
 * Generate a new token and public it to redis db
 *
 * @param {Integer} timeout (time until token is expired, default: 6hrs).
 * @param {Object} extraInfo (additional data).
 */
async function generateToken(timeoutSec = 6 * 60 * 60, extraInfo = {}) {
  if (!config.telemetryLoggingEnabled) return;

  logger.info('Generating new telemetry token');

  const timeNow = Math.floor(Date.now() / 1000);
  const timePadding = 60 * 60; // an hour padding

  const payload = {
    iat: timeNow - timePadding,
    exp: timeNow + timeoutSec + timePadding,

    node_id: config.nodeId,
    nonce: Math.random(),
    ...extraInfo,
  };

  const jwt = await createJWT({ nodeId: config.nodeId, payload });
  await Promise.all(
    managedNodeIds.map(async (nodeId) => {
      await telemetryDb.setToken(nodeId, jwt);
    })
  );

  logger.info('Finish generating telemetry token');
  tokenGenerationRetryCount = 0;
}

/*
 * Register token generation interval
 *
 * @param {integer} timeout (time between two tokens)
 * @param {Object} tokenInformation (refers to generateToken)
 */
async function createTokenGenerationTimeout() {
  if (!config.telemetryLoggingEnabled) return;

  disableTokenGeneration();

  let timeoutSec = tokenTimeoutSec;
  try {
    await generateToken(tokenTimeoutSec, {
      ...tokenInfo,
      'token-type': 'auto-generated',
    });
  } catch (err) {
    logger.error({
      msg: 'Failed to generate telemetry token, retry in 10 seconds',
      err,
    });

    // if retry count does not exceed limit, change timeout for retry
    if (tokenGenerationRetryCount < tokenGenerationRetryLimit) {
      tokenGenerationRetryCount++;
      timeoutSec = tokenGenerationRetryTimeoutSec;
    }
  }
  tokenGenerationTimeoutID = setTimeout(
    () => createTokenGenerationTimeout(),
    timeoutSec * 1000
  );
}

/*
 * Remove token generation timeout
 */
function disableTokenGeneration() {
  if (tokenGenerationTimeoutID) {
    clearTimeout(tokenGenerationTimeoutID);
  }
}

// manually create a token
export async function reissueToken() {
  if (!config.telemetryLoggingEnabled) return;
  await generateToken(tokenTimeoutSec, {
    ...tokenInfo,
    'token-type': 'manually-generated',
  });
}

export async function stop() {
  disableTokenGeneration();

  await telemetryEventsDb.unsubscribeFromNodeTokenDelete();

  initialized = false;
}
