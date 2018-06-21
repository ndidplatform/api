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

import path from 'path';
import Sequelize from 'sequelize';

import * as config from '../config';

const dbPath = path.join(
  config.dataDirectoryPath,
  `db-api-${config.nodeId}.sqlite`
);

const sequelize = new Sequelize('ndid-api', null, null, {
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
  operatorsAliases: false,
});

// Models
const Entities = {
  requestIdExpectedInBlock: sequelize.define('requestIdExpectedInBlock', {
    requestId: Sequelize.STRING,
    expectedBlockHeight: Sequelize.INTEGER,
  }),
  expectedIdpResponseNodeId: sequelize.define('expectedIdpResponseNodeId', {
    idpNodeId: Sequelize.STRING,
    expectedBlockHeight: Sequelize.INTEGER,
  }),
  requestToProcessReceivedFromMQ: sequelize.define('requestToProcessReceivedFromMQ', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    request: Sequelize.JSON,
  }),
  requestReceivedFromMQ: sequelize.define('requestReceivedFromMQ', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    request: Sequelize.JSON,
  }),
  responseDataFromRequestId: sequelize.define('responseDataFromRequestId', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    response: Sequelize.JSON,
  }),
  rpIdFromRequestId: sequelize.define('rpIdFromRequestId', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    rp_id: Sequelize.STRING,
  }),
  challengeFromRequestId: sequelize.define('challengeFromRequestId', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    challenge: Sequelize.JSON,
  }),
  proofReceivedFromMQ: sequelize.define('proofReceivedFromMQ', {
    responseId: { type: Sequelize.STRING, primaryKey: true },
    privateProofObject: Sequelize.JSON,
    publicProofArray: Sequelize.JSON,
  }),
  requestIdReferenceIdMapping: sequelize.define('requestIdReferenceIdMapping', {
    referenceId: { type: Sequelize.TEXT, primaryKey: true },
    requestId: { type: Sequelize.STRING, unique: true },
  }),
  onboardDataReferenceIdMapping: sequelize.define('onboardDataReferenceIdMapping', {
    referenceId: { type: Sequelize.TEXT, primaryKey: true },
    onboardData: { type: Sequelize.JSON, },
  }),
  requestData: sequelize.define('requestData', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    request: Sequelize.JSON,
  }),
  requestCallbackUrl: sequelize.define('requestCallbackUrl', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    url: Sequelize.TEXT,
  }),
  serviceCallbackUrl: sequelize.define('serviceCallbackUrl', {
    serviceId: { type: Sequelize.STRING, primaryKey: true },
    url: Sequelize.TEXT,
  }),
  dataFromAS: sequelize.define('dataFromAS', {
    requestId: Sequelize.STRING,
    data: Sequelize.JSON,
  }),
  timeoutScheduler: sequelize.define('timeoutScheduler', {
    requestId: Sequelize.STRING,
    unixTimeout: Sequelize.INTEGER,
  }),
  callbackWithRetry: sequelize.define('callbackWithRetry', {
    cbId: { type: Sequelize.STRING, primaryKey: true },
    data: Sequelize.JSON,
  }),
  identityRequestIdMapping: sequelize.define('identityRequestIdMapping', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    identity: Sequelize.JSON,
  }),
  idpResponseValid: sequelize.define('idpResponseValid', {
    requestId: Sequelize.STRING,
    validInfo: Sequelize.JSON,
  }),
};

const initDb = sequelize.sync();

export function close() {
  return sequelize.close();
}

export async function getList({ name, keyName, key, valueName }) {
  await initDb;
  const models = await Entities[name].findAll({
    attributes: [valueName],
    where: {
      [keyName]: key,
    },
  });
  return models.map((model) => model.get(valueName));
}

export async function count({ name, keyName, key }) {
  await initDb;
  const count = await Entities[name].count({
    where: {
      [keyName]: key,
    },
  });
  return count;
}

export async function getListRange({ name, keyName, keyRange, valueName }) {
  await initDb;
  const models = await Entities[name].findAll({
    attributes: [valueName],
    where: {
      [keyName]: {
        [Sequelize.Op.gte]: keyRange.gte,
        [Sequelize.Op.lte]: keyRange.lte,
      },
    },
  });
  return models.map((model) => model.get(valueName));
}

export async function pushToList({ name, keyName, key, valueName, value }) {
  await initDb;
  await Entities[name].create({
    [keyName]: key,
    [valueName]: value,
  });
}

export async function removeFromList({
  name,
  keyName,
  key,
  valueName,
  valuesToRemove,
}) {
  await initDb;
  await Entities[name].destroy({
    where: {
      [keyName]: key,
      [valueName]: {
        [Sequelize.Op.in]: valuesToRemove,
      },
    },
  });
}

export async function removeList({ name, keyName, key }) {
  await initDb;
  await Entities[name].destroy({
    where: {
      [keyName]: key,
    },
  });
}

export async function removeListRange({ name, keyName, keyRange }) {
  await initDb;
  await Entities[name].destroy({
    where: {
      [keyName]: {
        [Sequelize.Op.gte]: keyRange.gte,
        [Sequelize.Op.lte]: keyRange.lte,
      },
    },
  });
}

export async function removeAllLists({ name }) {
  await initDb;
  await Entities[name].destroy({
    where: {},
  });
}

export async function get({ name, keyName, key, valueName }) {
  await initDb;
  const model = await Entities[name].findOne({
    attributes: [valueName],
    where: {
      [keyName]: key,
    },
  });
  return model != null ? model.get(valueName) : null;
}

export async function set({ name, keyName, key, valueName, value }) {
  await initDb;
  await Entities[name].upsert({
    [keyName]: key,
    [valueName]: value,
  });
}

export async function remove({ name, keyName, key }) {
  await initDb;
  await Entities[name].destroy({
    where: {
      [keyName]: key,
    },
  });
}

export async function getAll({ name }) {
  await initDb;
  const models = await Entities[name].findAll({
    attributes: {
      exclude: ['id', 'createdAt', 'updatedAt'],
    },
  });
  return models.map((model) => model.get({ plain: true }));
}
