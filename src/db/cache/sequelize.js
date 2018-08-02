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
  `db-cache-api-${config.nodeId}.sqlite`
);

const sequelize = new Sequelize('ndid-api', null, null, {
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
  operatorsAliases: false,
});

// Models
export const Entities = {
  expectedTx: sequelize.define('expectedTx', {
    tx: { type: Sequelize.STRING, primaryKey: true },
    metadata: Sequelize.JSON,
  }),
  callbackUrl: sequelize.define('callbackUrl', {
    referenceId: { type: Sequelize.STRING, primaryKey: true },
    url: Sequelize.TEXT,
  }),
  requestIdExpectedInBlock: sequelize.define('requestIdExpectedInBlock', {
    requestId: Sequelize.STRING,
    expectedBlockHeight: Sequelize.INTEGER,
  }),
  expectedIdpResponseNodeIdInBlock: sequelize.define(
    'expectedIdpResponseNodeIdInBlock',
    {
      responseMetadata: Sequelize.JSON,
      expectedBlockHeight: Sequelize.INTEGER,
    }
  ),
  requestToProcessReceivedFromMQ: sequelize.define(
    'requestToProcessReceivedFromMQ',
    {
      requestId: { type: Sequelize.STRING, primaryKey: true },
      request: Sequelize.JSON,
    }
  ),
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
  privateProofReceivedFromMQ: sequelize.define('privateProofReceivedFromMQ', {
    responseId: { type: Sequelize.STRING, primaryKey: true },
    privateProofObject: Sequelize.JSON,
  }),
  publicProofReceivedFromMQ: sequelize.define('publicProofReceivedFromMQ', {
    responseId: { type: Sequelize.STRING, primaryKey: true },
    publicProofArray: Sequelize.JSON,
  }),
  requestIdReferenceIdMapping: sequelize.define('requestIdReferenceIdMapping', {
    referenceId: { type: Sequelize.TEXT, primaryKey: true },
    requestId: { type: Sequelize.STRING, primaryKey: true },
  }),
  createIdentityDataReferenceIdMapping: sequelize.define(
    'createIdentityDataReferenceIdMapping',
    {
      referenceId: { type: Sequelize.TEXT, primaryKey: true },
      createIdentityData: { type: Sequelize.JSON },
    }
  ),
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
  expectedDataSignInBlock: sequelize.define('expectedDataSignInBlock', {
    expectedBlockHeight: Sequelize.INTEGER,
    metadata: Sequelize.JSON,
  }),
  duplicateMessageTimeout: sequelize.define('duplicateMessageTimeout', {
    id: { type: Sequelize.STRING, primaryKey: true },
    unixTimeout: Sequelize.INTEGER,
  }),
  expectedIdpPublicProofInBlock: sequelize.define(
    'expectedIdpPublicProofInBlock',
    {
      responseMetadata: Sequelize.JSON,
      expectedBlockHeight: Sequelize.INTEGER,
    }
  ),
  rpIdFromDataRequestId: sequelize.define('rpIdFromDataRequestId', {
    dataRequestId: { type: Sequelize.STRING, primaryKey: true },
    rpId: Sequelize.STRING,
  }),
  requestMessage: sequelize.define('requestMessage', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    requestMessageAndSalt: Sequelize.JSON,
  }),
  requestMessageSalt: sequelize.define('requestMessageSalt', {
    requestId: { type: Sequelize.STRING, primaryKey: true },
    requestMessageSalt: Sequelize.STRING,
  }),
};

export const init = sequelize.sync();

export function close() {
  return sequelize.close();
}
