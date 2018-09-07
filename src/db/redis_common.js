import * as cacheDb from './cache/redis';

import CustomError from '../error/custom_error';
import errorType from '../error/type';

import * as config from '../config';

function prefixKey(key) {
  return `${config.nodeId}:${key}`;
}

function getRedis(dbName) {
  switch (dbName) {
    case 'cache':
      return cacheDb.redis;
    // case 'long-term':
    //   return longTermDb;
    default:
      throw new CustomError({ message: 'Unknown database name' });
  }
}

export async function getList({ dbName, name, keyName, key, valueName }) {
  try {
    const redis = getRedis(dbName);
    const result = await redis.lrange(
      prefixKey(`${dbName}-${name}-${key}`),
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

export async function getListWithRangeSupport({
  dbName,
  name,
  keyName,
  key,
  valueName,
}) {
  try {
    const redis = getRedis(dbName);
    const result = await redis.zrangebyscore(
      prefixKey(`${dbName}-${name}`),
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

export async function count({ dbName, name, keyName, key }) {
  try {
    const redis = getRedis(dbName);
    const length = await redis.llen(prefixKey(`${dbName}-${name}-${key}`));
    return length;
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'count', dbName, name },
    });
  }
}

export async function getListRange({
  dbName,
  name,
  keyName,
  keyRange,
  valueName,
}) {
  try {
    const redis = getRedis(dbName);
    const result = await redis.zrangebyscore(
      prefixKey(`${dbName}-${name}`),
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

export async function pushToList({
  dbName,
  name,
  keyName,
  key,
  valueName,
  value,
}) {
  try {
    const redis = getRedis(dbName);
    value = JSON.stringify(value);
    await redis.rpush(prefixKey(`${dbName}-${name}-${key}`), value);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'pushToList', dbName, name },
    });
  }
}

export async function pushToListWithRangeSupport({
  dbName,
  name,
  keyName,
  key,
  valueName,
  value,
}) {
  try {
    const redis = getRedis(dbName);
    value = JSON.stringify(value);
    await redis.zadd(prefixKey(`${dbName}-${name}`), 'NX', key, value);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'pushToList', dbName, name },
    });
  }
}

export async function removeList({ dbName, name, keyName, key }) {
  try {
    const redis = getRedis(dbName);
    await redis.del(prefixKey(`${dbName}-${name}-${key}`));
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'removeList', dbName, name },
    });
  }
}

export async function removeListRange({ dbName, name, keyName, keyRange }) {
  try {
    const redis = getRedis(dbName);
    await redis.zremrangebyscore(
      prefixKey(`${dbName}-${name}`),
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

export async function removeAllLists({ dbName, name }) {
  try {
    const redis = getRedis(dbName);
    const keys = await redis.keys(prefixKey(`${dbName}-${name}-*`));
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'removeAllLists', dbName, name },
    });
  }
}

export async function get({ dbName, name, keyName, key, valueName }) {
  try {
    const redis = getRedis(dbName);
    const result = await redis.get(prefixKey(`${dbName}-${name}-${key}`));
    return JSON.parse(result);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'get', dbName, name },
    });
  }
}

export async function set({ dbName, name, keyName, key, valueName, value }) {
  try {
    const redis = getRedis(dbName);
    value = JSON.stringify(value);
    await redis.set(prefixKey(`${dbName}-${name}-${key}`), value);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'set', dbName, name },
    });
  }
}

export async function remove({ dbName, name, keyName, key }) {
  try {
    const redis = getRedis(dbName);
    await redis.del(prefixKey(`${dbName}-${name}-${key}`));
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'remove', dbName, name },
    });
  }
}

export async function getAll({ dbName, name }) {
  try {
    const redis = getRedis(dbName);
    const keys = await redis.keys(prefixKey(`${dbName}-${name}-*`));
    if (keys.length > 0) {
      const result = await redis.mget(...keys);
      return result.map((item) => JSON.parse(item));
    } else {
      return [];
    }
  } catch (error) {
    throw new CustomError({
      errorType: errorType.DB_ERROR,
      cause: error,
      details: { operation: 'getAll', dbName, name },
    });
  }
}
