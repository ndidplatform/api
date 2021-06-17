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
import logger from '../logger';
import * as utils from '../utils';
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

// TOKEN Generation Module
async function createJWT({ nodeId, payload }) {
  const header = {
    type: 'JWT',
    alg: 'RS256',
  };

  const headerJSON = JSON.stringify(header);
  const encodedHeader = base64url(headerJSON);

  const payloadJSON = JSON.stringify(payload);
  const encodedPayload = base64url(payloadJSON);

  const token = encodedHeader + '.' + encodedPayload;
  const signature = await utils.createSignature(token, nodeId, false);
  const signedToken = token + '.' + base64url(signature);

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
