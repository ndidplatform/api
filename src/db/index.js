import path from 'path';
import levelup from 'levelup';
import leveldown from 'leveldown';
// import rocksdb from 'rocksdb';
import encode from 'encoding-down';

import * as config from '../config';

const dbPath = path.join(__dirname, `../../db-api-${config.nodeId}`);

const leveldownInstance = leveldown(dbPath);
// const rocksdbInstance = rocksdb(dbPath);

const db = levelup(encode(leveldownInstance, { valueEncoding: 'json' }));

export function put(key, subKey, value) {
  try {
    return db.put(`${key}-${subKey}`, value);
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function get(key, subKey) {
  try {
    const value = await db.get(`${key}-${subKey}`);
    return value;
  } catch (error) {
    if (error.notFound) {
      return undefined;
    }
    // TODO:
    throw error;
  }
}

export function del(key, subKey) {
  try {
    return db.del(`${key}-${subKey}`);
  } catch (error) {
    // TODO:
    throw error;
  }
}
