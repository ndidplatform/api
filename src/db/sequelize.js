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
  requestReceivedFromMQ: sequelize.define('requestReceivedFromMQ', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    request: Sequelize.JSON,
  }),
  rpIdFromRequestId: sequelize.define('rpIdFromRequestId', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    rp_id: Sequelize.STRING,
  }),
  challengeFromRequestId: sequelize.define('challengeFromRequestId', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    challenge: Sequelize.STRING,
  }),
  proofReceivedFromMQ: sequelize.define('proofReceivedFromMQ', {
    responseId: { type: Sequelize.STRING, primaryKey: true },
    privateProofObject: Sequelize.JSON,
  }),
  requestIdReferenceIdMapping: sequelize.define('requestIdReferenceIdMapping', {
    referenceId: { type: Sequelize.TEXT, primaryKey: true },
    requestId: { type: Sequelize.STRING, unique: true },
  }),
  requestToSendToAS: sequelize.define('requestToSendToAS', {
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
  identityRequestIdMapping: sequelize.define('identityRequestIdMapping', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    identity: Sequelize.JSON,
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
