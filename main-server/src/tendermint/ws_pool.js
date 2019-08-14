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

import { EventEmitter } from 'events';

import TendermintWsClient from './ws_client';

import CustomError from 'ndid-error/custom_error';

import * as config from '../config';

/**
 * @type {Array.<TendermintWsClient>}
 */
const wsClients = [];

let wsClientIndex = 0;

let availableConnectionPromise = null;
let availableConnectionPromiseResolve = null;
let connectedWsCount = 0;

export const metricsEventEmitter = new EventEmitter();

function connectWS(wsClient) {
  return new Promise((resolve) => {
    wsClient.once('connected', () => resolve());
    wsClient.connect();
  });
}

export async function initialize(connect = true) {
  const promises = [];
  for (let i = 0; i < config.tendermintWsConnections; i++) {
    const tendermintWsClient = new TendermintWsClient(`ws_pool_${i}`, false);
    tendermintWsClient.on('connected', () =>
      incrementWsConnectedConnectionCount()
    );
    tendermintWsClient.on('disconnected', () =>
      decrementWsConnectedConnectionCount()
    );
    wsClients.push(tendermintWsClient);
    if (connect) {
      promises.push(connectWS(tendermintWsClient));
    }
  }
  if (connect) {
    await Promise.all(promises);
  }
}

export async function connect() {
  const promises = [];
  for (let i = 0; i < wsClients.length; i++) {
    promises.push(connectWS(wsClients[i]));
  }
  await Promise.all(promises);
}

function getNextConnectedConnectionClientIndex(curentIndex) {
  for (let i = curentIndex; i < wsClients.length; i++) {
    if (wsClients[i].connected) {
      return i;
    }
  }
  if (curentIndex !== 0) {
    for (let i = 0; i < curentIndex; i++) {
      if (wsClients[i].connected) {
        return i;
      }
    }
  }
  return null;
}

export function waitForAvailableConnection() {
  if (connectedWsCount > 0) {
    return;
  }
  if (!availableConnectionPromise) {
    availableConnectionPromise = new Promise((resolve) => {
      availableConnectionPromiseResolve = () => {
        availableConnectionPromise = null;
        availableConnectionPromiseResolve = null;
        resolve();
      };
    });
  }
  return availableConnectionPromise;
}

// Round-robin
export function getConnection() {
  wsClientIndex = wsClientIndex % wsClients.length;
  if (!wsClients[wsClientIndex].connected) {
    const nextConnectedConnectionClientIndex = getNextConnectedConnectionClientIndex(
      wsClientIndex
    );
    if (nextConnectedConnectionClientIndex == null) {
      throw new CustomError({
        message: 'No connected WS available',
      });
    }
    wsClientIndex = nextConnectedConnectionClientIndex;
    return wsClients[wsClientIndex];
  }
  return wsClients[wsClientIndex++];
}

export function closeAllConnections() {
  for (let i = 0; i < wsClients.length; i++) {
    wsClients[i].close();
  }
}

function incrementWsConnectedConnectionCount() {
  connectedWsCount++;
  if (connectedWsCount > 0) {
    if (availableConnectionPromiseResolve) {
      availableConnectionPromiseResolve();
    }
  }
  metricsEventEmitter.emit('connectedConnectionCount', connectedWsCount);
}

function decrementWsConnectedConnectionCount() {
  connectedWsCount--;
  metricsEventEmitter.emit('connectedConnectionCount', connectedWsCount);
}
