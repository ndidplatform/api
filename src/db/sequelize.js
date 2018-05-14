import path from 'path';
import Sequelize from 'sequelize';

import * as config from '../config';

const dbPath = path.join(
  __dirname,
  '..',
  '..',
  `db-api-${config.nodeId}.sqlite`
);

const sequelize = new Sequelize('ndid-api', null, null, {
  dialect: 'sqlite',
  storage: dbPath,
});

// Models
const Entities = {
  requestIdExpectedInBlock: sequelize.define('requestIdExpectedInBlock', {
    requestId: Sequelize.STRING,
    expectedBlockHeight: Sequelize.INTEGER,
  }),
  requestReceivedFromMQ: sequelize.define('requestReceivedFromMQ', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    request: Sequelize.JSON,
  }),
  requestIdReferenceIdMapping: sequelize.define('requestIdReferenceIdMapping', {
    referenceId: { type: Sequelize.TEXT, primaryKey: true },
    requestId: { type: Sequelize.STRING, unique: true },
  }),
  requestToSendToAS: sequelize.define('requestToSendToAS', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    request: Sequelize.JSON,
  }),
  callbackUrl: sequelize.define('callbackUrl', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    url: Sequelize.TEXT,
  }),
  dataFromAS: sequelize.define('dataFromAS', {
    requestId: Sequelize.STRING,
    asNodeId: Sequelize.STRING,
    data: Sequelize.JSON,
  }),
};

sequelize.sync();

export async function getList({ name, keyName, key }) {
  const models = await Entities[name].findAll({
    where: {
      [keyName]: key,
    },
  });
  return models.map((model) => model.get({ plain: true }));
}

export async function getListRange({ name, keyName, keyRange }) {
  const models = await Entities[name].findAll({
    where: {
      [keyName]: {
        [Sequelize.Op.gte]: keyRange.gte,
        [Sequelize.Op.lte]: keyRange.lte,
      },
    },
  });
  return models.map((model) => model.get({ plain: true }));
}

export async function pushToList({ name, keyName, key, valueName, value }) {
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
  await Entities[name].destroy({
    where: {
      [keyName]: key,
    },
  });
}

export async function removeAllLists({ name }) {
  await Entities[name].destroy({
    where: {},
  });
}

export async function get({ name, keyName, key }) {
  const model = await Entities[name].findOne({
    where: {
      [keyName]: key,
    },
  });
  return model != null ? model.get({ plain: true }) : null;
}

export async function set({ name, keyName, key, valueName, value }) {
  await Entities[name].upsert({
    [keyName]: key,
    [valueName]: value,
  });
}

export async function remove({ name, keyName, key, valueName, value }) {
  await Entities[name].destroy({
    where: {
      [keyName]: key,
    },
  });
}
