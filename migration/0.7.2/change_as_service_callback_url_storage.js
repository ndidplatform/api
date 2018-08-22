// MUST USE WITH Node.js >= 8

const path = require('path');
const fs = require('fs');
const Sequelize = require('sequelize');

const defaultDataDirectoryPath = path.join(__dirname, '..', '..', 'data');

const nodeId = process.env.NODE_ID;
const dataDirectoryPath =
  process.env.DATA_DIRECTORY_PATH || defaultDataDirectoryPath;

const callbackUrlFilesPrefix = path.join(
  dataDirectoryPath,
  'as-callback-url-' + nodeId
);

const dbPath = path.join(dataDirectoryPath, `db-cache-api-${nodeId}.sqlite`);

const sequelize = new Sequelize('ndid-api', null, null, {
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
  operatorsAliases: false,
});

const Entities = {
  serviceCallbackUrl: sequelize.define('serviceCallbackUrl', {
    serviceId: { type: Sequelize.STRING, primaryKey: true },
    url: Sequelize.TEXT,
  }),
};

async function getAll({ name }) {
  try {
    const models = await Entities[name].findAll({
      attributes: {
        exclude: ['id', 'createdAt', 'updatedAt'],
      },
    });
    return models.map((model) => model.get({ plain: true }));
  } catch (error) {
    console.error('getAll() error:', error);
  }
}

function setServiceCallbackUrl(serviceId, url) {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      callbackUrlFilesPrefix + '-service-' + serviceId,
      url,
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

async function main() {
  if (nodeId == null || nodeId === '') {
    console.error('NODE_ID env var must be set');
    process.exit(1);
  }

  if (
    process.env.DATA_DIRECTORY_PATH == null ||
    process.env.DATA_DIRECTORY_PATH === ''
  ) {
    console.log(
      'DATA_DIRECTORY_PATH env var not set. Using default path:',
      defaultDataDirectoryPath
    );
  }

  const serviceCallbackUrls = await getAll({ name: 'serviceCallbackUrl' });
  await Promise.all(
    serviceCallbackUrls.map(({ serviceId, url }) =>
      setServiceCallbackUrl(serviceId, url)
    )
  );
  console.log('Migration DONE!');
}

main();
