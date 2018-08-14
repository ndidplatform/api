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

import Sequelize from 'sequelize';

import * as cacheDb from './cache/sequelize';
import * as longTermDb from './long_term/sequelize';

import CustomError from '../error/custom_error';
import errorType from '../error/type';

function getDB(dbName) {
  switch (dbName) {
    case 'cache':
      return cacheDb;
    case 'long-term':
      return longTermDb;
    default:
      throw new CustomError({ message: 'Unknown database name' });
  }
}

export async function getList({ dbName, name, keyName, key, valueName }) {
  try {
    const db = getDB(dbName);
    await db.init;
    const models = await db.Entities[name].findAll({
      attributes: [valueName],
      where: {
        [keyName]: key,
      },
    });
    return models.map((model) => model.get(valueName));
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'getList', dbName, table: name },
    });
  }
}

export async function count({ dbName, name, keyName, key }) {
  try {
    const db = getDB(dbName);
    await db.init;
    const count = await db.Entities[name].count({
      where: {
        [keyName]: key,
      },
    });
    return count;
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'count', dbName, table: name },
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
    const db = getDB(dbName);
    await db.init;
    const models = await db.Entities[name].findAll({
      attributes: [valueName],
      where: {
        [keyName]: {
          [Sequelize.Op.gte]: keyRange.gte,
          [Sequelize.Op.lte]: keyRange.lte,
        },
      },
    });
    return models.map((model) => model.get(valueName));
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'getListRange', dbName, table: name },
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
    const db = getDB(dbName);
    await db.init;
    await db.Entities[name].create({
      [keyName]: key,
      [valueName]: value,
    });
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'pushToList', dbName, table: name },
    });
  }
}

export async function removeFromList({
  dbName,
  name,
  keyName,
  key,
  valueName,
  valuesToRemove,
}) {
  try {
    const db = getDB(dbName);
    await db.init;
    await db.Entities[name].destroy({
      where: {
        [keyName]: key,
        [valueName]: {
          [Sequelize.Op.in]: valuesToRemove,
        },
      },
    });
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'removeFromList', dbName, table: name },
    });
  }
}

export async function removeList({ dbName, name, keyName, key }) {
  try {
    const db = getDB(dbName);
    await db.init;
    await db.Entities[name].destroy({
      where: {
        [keyName]: key,
      },
    });
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'removeList', dbName, table: name },
    });
  }
}

export async function removeListRange({ dbName, name, keyName, keyRange }) {
  try {
    const db = getDB(dbName);
    await db.init;
    await db.Entities[name].destroy({
      where: {
        [keyName]: {
          [Sequelize.Op.gte]: keyRange.gte,
          [Sequelize.Op.lte]: keyRange.lte,
        },
      },
    });
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'removeListRange', dbName, table: name },
    });
  }
}

export async function removeAllLists({ dbName, name }) {
  try {
    const db = getDB(dbName);
    await db.init;
    await db.Entities[name].destroy({
      where: {},
    });
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'removeAllLists', dbName, table: name },
    });
  }
}

export async function get({ dbName, name, keyName, key, valueName }) {
  try {
    const db = getDB(dbName);
    await db.init;
    const model = await db.Entities[name].findOne({
      attributes: [valueName],
      where: {
        [keyName]: key,
      },
    });
    return model != null ? model.get(valueName) : null;
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'get', dbName, table: name },
    });
  }
}

export async function set({ dbName, name, keyName, key, valueName, value }) {
  try {
    const db = getDB(dbName);
    await db.init;
    await db.Entities[name].upsert({
      [keyName]: key,
      [valueName]: value,
    });
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'set', dbName, table: name },
    });
  }
}

export async function remove({ dbName, name, keyName, key }) {
  try {
    const db = getDB(dbName);
    await db.init;
    await db.Entities[name].destroy({
      where: {
        [keyName]: key,
      },
    });
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'remove', dbName, table: name },
    });
  }
}

export async function getAll({ dbName, name }) {
  try {
    const db = getDB(dbName);
    await db.init;
    const models = await db.Entities[name].findAll({
      attributes: {
        exclude: ['id', 'createdAt', 'updatedAt'],
      },
    });
    return models.map((model) => model.get({ plain: true }));
  } catch (error) {
    throw new CustomError({
      message: errorType.DB_ERROR.message,
      code: errorType.DB_ERROR.code,
      cause: error,
      details: { operation: 'getAll', dbName, table: name },
    });
  }
}
