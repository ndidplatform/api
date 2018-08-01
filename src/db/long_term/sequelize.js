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

import * as config from '../../config';

const dbPath = path.join(
  config.dataDirectoryPath,
  `db-long-term-api-${config.nodeId}.sqlite`
);

const sequelize = new Sequelize('ndid-api', null, null, {
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
  operatorsAliases: false,
});

// Models
export const Entities = {};

if (config.role === 'rp' || config.role === 'idp') {
  Entities.challengeRequestMessage = sequelize.define(
    'challengeRequestMessage',
    {
      requestId: Sequelize.STRING,
      message: Sequelize.TEXT,
    }
  );
  Entities.idpResponseMessage = sequelize.define('idpResponseMessage', {
    requestId: Sequelize.STRING,
    message: Sequelize.TEXT,
  });
}

if (config.role === 'rp') {
  Entities.asDataResponseMessage = sequelize.define('asDataResponseMessage', {
    requestId: Sequelize.STRING,
    message: Sequelize.TEXT,
  });
}

if (config.role === 'idp') {
  Entities.challengeResponseMessage = sequelize.define(
    'challengeResponseMessage',
    {
      requestId: Sequelize.STRING,
      message: Sequelize.TEXT,
    }
  );
  Entities.consentRequestMessage = sequelize.define('consentRequestMessage', {
    requestId: Sequelize.STRING,
    message: Sequelize.TEXT,
  });
}

if (config.role === 'as') {
  Entities.dataRequestMessage = sequelize.define('dataRequestMessage', {
    requestId: Sequelize.STRING,
    message: Sequelize.TEXT,
  });
}

export const init = sequelize.sync();

export function close() {
  return sequelize.close();
}
