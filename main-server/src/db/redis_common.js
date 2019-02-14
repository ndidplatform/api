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

import cacheDbRedisInstance from './cache/redis';
import longTermDbRedisInstance from './long_term/redis';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

function getRedis(dbName) {
  switch (dbName) {
    case 'cache':
      return cacheDbRedisInstance.redis;
    case 'long-term':
      return longTermDbRedisInstance.redis;
    default:
      throw new CustomError({ message: 'Unknown database name' });
  }
}

export async function getList({ nodeId, dbName, name, key }) {
  try {
    const redis = getRedis(dbName);
    const result = await redis.lrange(
      `${nodeId}:${dbName}:${name}:${key}`,
      0,
      -1
    );
    return result.map((item) => JSON.parse(item));
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'getList', dbName, name },
    });
  }
}

export async function getListWithRangeSupport({ nodeId, dbName, name, key }) {
  try {
    const redis = getRedis(dbName);
    const result = await redis.zrangebyscore(
      `${nodeId}:${dbName}:${name}`,
      key,
      key
    );
    return result.map((item) => JSON.parse(item));
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'getList', dbName, name },
    });
  }
}

export async function count({ nodeId, dbName, name, key }) {
  try {
    const redis = getRedis(dbName);
    const length = await redis.llen(`${nodeId}:${dbName}:${name}:${key}`);
    return length;
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'count', dbName, name },
    });
  }
}

export async function getListRange({ nodeId, dbName, name, keyRange }) {
  try {
    const redis = getRedis(dbName);
    const result = await redis.zrangebyscore(
      `${nodeId}:${dbName}:${name}`,
      keyRange.gte,
      keyRange.lte
    );
    return result.map((item) => JSON.parse(item));
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'getListRange', dbName, name },
    });
  }
}

export async function pushToList({ nodeId, dbName, name, key, value }) {
  try {
    const redis = getRedis(dbName);
    value = JSON.stringify(value);
    await redis.rpush(`${nodeId}:${dbName}:${name}:${key}`, value);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'pushToList', dbName, name },
    });
  }
}

export async function pushToListWithRangeSupport({
  nodeId,
  dbName,
  name,
  key,
  value,
}) {
  try {
    const redis = getRedis(dbName);
    value = JSON.stringify(value);
    await redis.zadd(`${nodeId}:${dbName}:${name}`, 'NX', key, value);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'pushToList', dbName, name },
    });
  }
}

export async function removeList({ nodeId, dbName, name, key }) {
  try {
    const redis = getRedis(dbName);
    await redis.del(`${nodeId}:${dbName}:${name}:${key}`);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'removeList', dbName, name },
    });
  }
}

export async function removeListRange({ nodeId, dbName, name, keyRange }) {
  try {
    const redis = getRedis(dbName);
    await redis.zremrangebyscore(
      `${nodeId}:${dbName}:${name}`,
      keyRange.gte,
      keyRange.lte
    );
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'removeListRange', dbName, name },
    });
  }
}

export async function removeListWithRangeSupport({ nodeId, dbName, name }) {
  try {
    const redis = getRedis(dbName);
    await redis.del(`${nodeId}:${dbName}:${name}`);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'removeListWithRangeSupport', dbName, name },
    });
  }
}

export async function removeAllLists({ nodeId, dbName, name }) {
  try {
    const redis = getRedis(dbName);
    await new Promise((resolve, reject) => {
      const stream = redis.scanStream({
        match: `${nodeId}:${dbName}:${name}:*`,
        count: 100,
      });
      const pipeline = redis.pipeline();
      stream.on('data', (keys) => {
        if (keys.length) {
          pipeline.del(...keys);
        }
      });
      stream.on('end', async () => {
        try {
          await pipeline.exec();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'removeAllLists', dbName, name },
    });
  }
}

export async function get({ nodeId, dbName, name, key }) {
  try {
    const redis = getRedis(dbName);
    const result = await redis.get(`${nodeId}:${dbName}:${name}:${key}`);
    return JSON.parse(result);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'get', dbName, name },
    });
  }
}

export async function set({ nodeId, dbName, name, key, value }) {
  try {
    const redis = getRedis(dbName);
    value = JSON.stringify(value);
    await redis.set(`${nodeId}:${dbName}:${name}:${key}`, value);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'set', dbName, name },
    });
  }
}

export async function remove({ nodeId, dbName, name, key }) {
  try {
    const redis = getRedis(dbName);
    await redis.del(`${nodeId}:${dbName}:${name}:${key}`);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'remove', dbName, name },
    });
  }
}

export async function getAll({ nodeId, dbName, name, keyName, valueName }) {
  try {
    const redis = getRedis(dbName);
    const retVal = await new Promise((resolve) => {
      let result = [];
      const stream = redis.scanStream({
        match: `${nodeId}:${dbName}:${name}:*`,
        count: 100,
      });
      stream.on('data', (keys) => {
        if (keys.length) {
          stream.pause();
          redis.mget(...keys).then((resultPart) => {
            const resultPartParsed = resultPart.map((item, index) => {
              return {
                [keyName]: keys[index].replace(
                  `${nodeId}:${dbName}:${name}:`,
                  ''
                ),
                [valueName]: JSON.parse(item),
              };
            });
            result = result.concat(resultPartParsed);
            stream.resume();
          });
        }
      });
      stream.on('end', () => resolve(result));
    });
    return retVal;
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'getAll', dbName, name },
    });
  }
}

//

export async function getFlattenList({ nodeId, dbName, name }) {
  try {
    const redis = getRedis(dbName);
    const lists = await new Promise((resolve) => {
      const result = [];
      const stream = redis.scanStream({
        match: `${nodeId}:${dbName}:${name}:*`,
        count: 100,
      });
      stream.on('data', (keys) => {
        if (keys.length) {
          stream.pause();

          Promise.all(
            keys.map(async (key) => {
              const _key = key.substring(key.lastIndexOf(':') + 1);
              result.push({
                list: await getList({ nodeId, dbName, name, key: _key }),
                key: _key,
              });
            })
          ).then(() => {
            stream.resume();
          });
        }
      });
      stream.on('end', () => resolve(result));
    });

    return lists;
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'getFlattenList', dbName, name },
    });
  }
}

export async function getFlattenListWithRangeSupport({ nodeId, dbName, name }) {
  try {
    const list = await getListRange({
      nodeId,
      dbName,
      name,
      keyRange: { gte: '-inf', lte: '+inf' },
    });
    return list;
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'getFlattenListWithRangeSupport', dbName, name },
    });
  }
}
