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

import 'source-map-support/register';

import TokenManager from './token';
import TelemetryClient from './telemetry-client';
import TelemetryDb from './db';

import * as config from './config';
import logger from './logger';

// Initialize token manager
const tokenManager = new TokenManager();

// Initialize telemetry client
const client = new TelemetryClient({
  tokenManager,
});

// get list of all node IDs
const nodeIds = config.nodeIds.split(',');
logger.info({
  message: 'List of monitored nodes',
  nodeIds,
});

const intervalPerNode = config.flushIntervalMs / nodeIds.length;

// Initialize database fetching
const db = new TelemetryDb([
  {
    // database for token fetching
    id: 'token-db',
    type: 'key-value',
    keyPrefix: 'token',
    onCreated: (db) => {
      tokenManager.setGetToken(async (nodeId) => {
        return await db.getKey(nodeId);
      });
      tokenManager.setRemoveToken(async (nodeId) => {
        return await db.unlinkKey(nodeId);
      });
      tokenManager.setPublishRequestNewTokenEvent(async (nodeId) => {
        return await db.publish('request_new', nodeId);
      });
    },
  },
  // Request events
  ...nodeIds.map((nodeId, idx) => ({
    id: `request-event-stream:${nodeId}`,
    type: 'stream',
    channelName: `${nodeId}:request-events`,
    onDataReceived: (events) => {
      return client.receiveRequestEventData(nodeId, events);
    },
    delayStart: intervalPerNode * idx,
    countLimit: 300,
    timeLimit: config.flushIntervalMs, // flush every 5 seconds
    streamMaxCapacity: config.requestEventStreamMaxCapacity,
  })),
  // Main version log
  ...nodeIds.map((nodeId) => ({
    id: `main-version-log-stream:${nodeId}`,
    type: 'stream',
    channelName: `${nodeId}:main-version-logs`,
    onDataReceived: (logs) => {
      return client.receiveMainVersionLogData(nodeId, logs);
    },
    delayStart: 0,
    countLimit: 100,
    timeLimit: config.flushIntervalMs, // flush every 5 seconds
    streamMaxCapacity: 10000,
  })),
  // MQ service version log
  ...nodeIds.map((nodeId) => ({
    id: `mq-service-version-log-stream:${nodeId}`,
    type: 'stream',
    channelName: `${nodeId}:mq-service-version-logs`,
    onDataReceived: (logs) => {
      return client.receiveMQServiceVersionLogData(nodeId, logs);
    },
    delayStart: 0,
    countLimit: 100,
    timeLimit: config.flushIntervalMs, // flush every 5 seconds
    streamMaxCapacity: 10000,
  })),
  // Tendermint and ABCI version log
  ...nodeIds.map((nodeId) => ({
    id: `tendermint-abci-version-log-stream:${nodeId}`,
    type: 'stream',
    channelName: `${nodeId}:tendermint-abci-version-logs`,
    onDataReceived: (logs) => {
      return client.receiveTendermintAndABCIVersionLogData(nodeId, logs);
    },
    delayStart: 0,
    countLimit: 100,
    timeLimit: config.flushIntervalMs, // flush every 5 seconds
    streamMaxCapacity: 10000,
  })),
]);
