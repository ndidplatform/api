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

// For development use only
import 'source-map-support/register';

import fs from 'fs';
import path from 'path';
import { mkdirp } from 'mkdirp';

import * as cacheDb from './db/cache';

import * as ndid from './core/ndid';
import * as tendermint from './tendermint';
import * as nodeKey from './utils/node_key';
import * as cryptoUtils from './utils/crypto';

import * as config from './config';

const nodes = [
  { nodeId: 'rp1', role: 'rp' },
  { nodeId: 'rp2', role: 'rp' },
  { nodeId: 'rp3', role: 'rp' },
  { nodeId: 'idp1', role: 'idp' },
  { nodeId: 'idp2', role: 'idp' },
  { nodeId: 'idp3', role: 'idp' },
  { nodeId: 'as1', role: 'as' },
  { nodeId: 'as2', role: 'as' },
  { nodeId: 'as3', role: 'as' },
  { nodeId: 'proxy1', role: 'proxy' },
  { nodeId: 'proxy2', role: 'proxy' },
];

const nodesBehindProxy = [
  {
    nodeId: 'proxy1_rp4',
    role: 'rp',
    proxyNodeId: 'proxy1',
    config: 'KEY_ON_PROXY',
  },
  {
    nodeId: 'proxy2_rp5',
    role: 'rp',
    proxyNodeId: 'proxy2',
    config: 'KEY_ON_PROXY',
  },
  {
    nodeId: 'proxy1_idp4',
    role: 'idp',
    proxyNodeId: 'proxy1',
    config: 'KEY_ON_PROXY',
  },
  {
    nodeId: 'proxy2_idp5',
    role: 'idp',
    proxyNodeId: 'proxy2',
    config: 'KEY_ON_PROXY',
  },
  {
    nodeId: 'proxy1_as4',
    role: 'as',
    proxyNodeId: 'proxy1',
    config: 'KEY_ON_PROXY',
  },
  {
    nodeId: 'proxy2_as5',
    role: 'as',
    proxyNodeId: 'proxy2',
    config: 'KEY_ON_PROXY',
  },
];

const services = [
  {
    serviceId: 'bank_statement',
    serviceName: 'All transactions in the past 3 months',
  },
  {
    serviceId: 'customer_info',
    serviceName: 'Customer information',
  },
];

process.on('unhandledRejection', function (reason, p) {
  console.error('Unhandled Rejection', p, reason.stack || reason);
});

// Make sure data and log directories exist
mkdirp.sync(config.dataDirectoryPath);
// mkdirp.sync(config.logDirectoryPath);

async function addKeyAndSetToken(nodeId, role, behindProxy, index) {
  const node_name = ''; //all anonymous

  const filePath = behindProxy
    ? path.join(
        __dirname,
        '..',
        'dev_key',
        'behind_proxy',
        'keys',
        nodeId + '.pub'
      )
    : path.join(__dirname, '..', 'dev_key', 'keys', nodeId + '.pub');
  const signing_public_key = fs.readFileSync(filePath, 'utf8').toString();

  const masterFilePath = behindProxy
    ? path.join(
        __dirname,
        '..',
        'dev_key',
        'behind_proxy',
        'master_keys',
        nodeId + '_master.pub'
      )
    : path.join(
        __dirname,
        '..',
        'dev_key',
        'master_keys',
        nodeId + '_master.pub'
      );
  const signing_master_public_key = fs
    .readFileSync(masterFilePath, 'utf8')
    .toString();

  const encryptionKeyFilePath = behindProxy
    ? path.join(
        __dirname,
        '..',
        'dev_key',
        'behind_proxy',
        'encryption_keys',
        nodeId + '.pub'
      )
    : path.join(__dirname, '..', 'dev_key', 'encryption_keys', nodeId + '.pub');
  const encryption_public_key = fs
    .readFileSync(encryptionKeyFilePath, 'utf8')
    .toString();

  let node = {
    node_id: nodeId,
    node_name: JSON.stringify({
      marketing_name_th: `${nodeId}_TH`,
      marketing_name_en: `${nodeId}_EN`,
      industry_code: `00${(index % 3) + 1}`,
    }),
    signing_public_key,
    signing_key_algorithm: cryptoUtils.keyAlgorithm.RSA,
    signing_algorithm:
      cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_256.name,
    signing_master_public_key,
    signing_master_key_algorithm: cryptoUtils.keyAlgorithm.RSA,
    signing_master_algorithm:
      cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_256.name,
    encryption_public_key,
    encryption_key_algorithm: cryptoUtils.keyAlgorithm.RSA,
    encryption_algorithm: cryptoUtils.encryptionAlgorithm.RSAES_PKCS1_V1_5.name,
    role,
  };
  if (role === 'idp') {
    node = {
      ...node,
      max_ial: 3,
      max_aal: 3,
      supported_feature_list: [],
    };
  }

  await ndid.registerNode(node, { synchronous: true });

  await ndid.setNodeToken({
    node_id: nodeId,
    amount: 100000,
  });
}

function addNodeToProxyNode(nodeId, proxyNodeId, nodeProxyConfig) {
  return ndid.addNodeToProxyNode({
    node_id: nodeId,
    proxy_node_id: proxyNodeId,
    config: nodeProxyConfig,
  });
}

export async function init() {
  await cacheDb.initialize();

  tendermint.setWaitForInitEndedBeforeReady(false);

  const tendermintReady = new Promise((resolve) =>
    tendermint.eventEmitter.once('ready', () => resolve())
  );

  await tendermint.connectWS();
  await tendermintReady;

  await nodeKey.initialize();
  await tendermint.initialize();

  console.log('========= Initializing keys for development =========');

  const publicKeyFilePath = path.join(
    __dirname,
    '..',
    'dev_key',
    'keys',
    'ndid1.pub'
  );
  const masterPublicKeyFilePath = path.join(
    __dirname,
    '..',
    'dev_key',
    'master_keys',
    'ndid1_master.pub'
  );
  const encryptionPublicKeyFilePath = path.join(
    __dirname,
    '..',
    'dev_key',
    'encryption_keys',
    'ndid1.pub'
  );
  const signing_public_key = fs
    .readFileSync(publicKeyFilePath, 'utf8')
    .toString();
  const signing_master_public_key = fs
    .readFileSync(masterPublicKeyFilePath, 'utf8')
    .toString();
  const encryption_public_key = fs
    .readFileSync(encryptionPublicKeyFilePath, 'utf8')
    .toString();

  try {
    await ndid.initNDID({
      signing_public_key,
      signing_key_algorithm: 'RSA',
      signing_algorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
      signing_master_public_key,
      signing_master_key_algorithm: 'RSA',
      signing_master_algorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
      encryption_public_key,
      encryption_key_algorithm: 'RSA',
      encryption_algorithm: 'RSAES_PKCS1_V1_5',
    });
    await ndid.endInit();

    console.log('========= Adding supported IAL list =========');
    await ndid.setSupportedIALList({
      supported_ial_list: [1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3],
    });
    console.log('========= Done adding supported IAL list =========');

    console.log('========= Adding supported AAL list =========');
    await ndid.setSupportedAALList({
      supported_aal_list: [1, 2.1, 2.2, 3],
    });
    console.log('========= Done adding supported AAL list =========');

    console.log(
      '========= Adding allowed node supported feature (on_the_fly) ========='
    );
    await ndid.addAllowedNodeSupportedFeature({
      name: 'on_the_fly',
    });
    console.log(
      '========= Done adding allowed node supported feature (on_the_fly) ========='
    );

    await Promise.all(
      nodes.map(({ nodeId, role }, index) =>
        addKeyAndSetToken(nodeId, role, false, index)
      )
    );
    await Promise.all(
      nodesBehindProxy.map(({ nodeId, role }, index) =>
        addKeyAndSetToken(nodeId, role, true, index)
      )
    );
    await Promise.all(
      nodesBehindProxy.map(({ nodeId, proxyNodeId, config: nodeProxyConfig }) =>
        addNodeToProxyNode(nodeId, proxyNodeId, nodeProxyConfig)
      )
    );
    console.log('========= Keys for development initialized =========');

    console.log('========= Adding namespaces and services =========');
    await ndid.addNamespace({
      namespace: 'citizen_id',
      description: 'Thai citizen ID',
    });
    await ndid.addNamespace({
      namespace: 'passport_num',
      description: 'Passport Number',
    });
    await Promise.all(
      services.map(({ serviceId, serviceName }) =>
        ndid.addService({
          service_id: serviceId,
          service_name: serviceName,
        })
      )
    );

    const asNodes = [
      ...nodes.filter(({ role }) => role === 'as').map(({ nodeId }) => nodeId),
      ...nodesBehindProxy
        .filter(({ role }) => role === 'as')
        .map(({ nodeId }) => nodeId),
    ];

    await Promise.all(
      asNodes.map((nodeId) => {
        return Promise.all(
          services.map(({ serviceId }) => {
            return ndid.approveService({
              node_id: nodeId,
              service_id: serviceId,
            });
          })
        );
      })
    );

    console.log('========= Adding IdP error codes =========');
    await ndid.addErrorCode({
      type: 'idp',
      error_code: 10101,
      description: 'Unknown identity',
    });
    console.log('========= Done adding IdP error codes =========');

    console.log('========= Adding AS error codes =========');
    await ndid.addErrorCode({
      type: 'as',
      error_code: 10101,
      description: 'Unknown identity',
    });
    console.log('========= Done adding AS error codes =========');

    console.log('========= Done =========');
  } catch (error) {
    console.error('Cannot initialize NDID platform:', error);
    process.exit(1);
  }

  process.exit();
}

init();
