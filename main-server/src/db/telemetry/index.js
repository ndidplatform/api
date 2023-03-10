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

import * as db from '../redis_common';
import redisInstance from './redis';

import logger from '../../logger';
import CustomError from 'ndid-error/custom_error';

const dbName = 'telemetry';

export function getRedisInstance() {
  return redisInstance;
}

export function initialize() {
  return redisInstance.connect();
}

export async function close() {
  await redisInstance.close();
  logger.info({
    message: 'DB connection closed',
    dbName,
  });
}

function getRedis() {
  return getRedisInstance().redis;
}

export async function addMainVersionLog(
  nodeId,
  { node_id, version, source_timestamp }
) {
  try {
    await getRedis().xadd(
      `${nodeId}:main-version-logs`,
      '*',
      'node_id',
      node_id,
      'version',
      version,
      'source_timestamp',
      source_timestamp
    );
  } catch (err) {
    logger.error({ err });
  }
}

export async function addMQServiceVersionLog(
  nodeId,
  { node_id, version, source_timestamp }
) {
  try {
    await getRedis().xadd(
      `${nodeId}:mq-service-version-logs`,
      '*',
      'node_id',
      node_id,
      'version',
      version,
      'source_timestamp',
      source_timestamp
    );
  } catch (err) {
    logger.error({ err });
  }
}

export async function addTendermintAndABCIVersionLog(
  nodeId,
  {
    node_id,
    tendermint_version,
    abci_version,
    abci_app_version,
    source_timestamp,
  }
) {
  try {
    await getRedis().xadd(
      `${nodeId}:tendermint-abci-version-logs`,
      '*',
      'node_id',
      node_id,
      'tendermint_version',
      tendermint_version,
      'abci_version',
      abci_version,
      'abci_app_version',
      abci_app_version,
      'source_timestamp',
      source_timestamp
    );
  } catch (err) {
    logger.error({ err });
  }
}

export async function addProcessLog(nodeId, { node_id, process_name, log }) {
  try {
    await getRedis().xadd(
      `${nodeId}:process-logs`,
      '*',
      'node_id',
      node_id,
      'process_name',
      process_name,
      'log',
      log
    );
  } catch (err) {
    logger.error({ err });
  }
}

export async function addNewRequestEvent(
  nodeId,
  { request_id, node_id, state_code, source_timestamp, additional_data }
) {
  try {
    let additionalData = [];
    if (additional_data != null) {
      additionalData = ['additional_data', JSON.stringify(additional_data)];
    }

    await getRedis().xadd(
      `${nodeId}:request-events`,
      '*',
      'request_id',
      request_id,
      'node_id',
      node_id,
      'state_code',
      state_code,
      'source_timestamp',
      source_timestamp,
      ...additionalData
    );
  } catch (err) {
    logger.error({ err });
  }
}

export async function setToken(nodeId, token) {
  try {
    await getRedis().set(`token:${nodeId}`, token);
  } catch (err) {
    logger.error({ err });
  }
}
