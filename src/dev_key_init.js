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
import mkdirp from 'mkdirp';

import * as ndid from './core/ndid';
import * as tendermint from './tendermint';
import * as nodeKey from './utils/node_key';

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
    serviceName: 'Customer infomation',
  },
];

process.on('unhandledRejection', function(reason, p) {
  console.error('Unhandled Rejection', p, reason.stack || reason);
});

// Make sure data and log directories exist
mkdirp.sync(config.dataDirectoryPath);
mkdirp.sync(config.logDirectoryPath);

async function addKeyAndSetToken(nodeId, role, behindProxy) {
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
  const public_key = fs.readFileSync(filePath, 'utf8').toString();

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
  const master_public_key = fs.readFileSync(masterFilePath, 'utf8').toString();

  let node = {
    node_id: nodeId,
    node_name,
    public_key,
    master_public_key,
    role,
  };
  if (role === 'idp') {
    node = {
      ...node,
      max_ial: 3,
      max_aal: 3,
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
  const public_key = fs.readFileSync(publicKeyFilePath, 'utf8').toString();
  const master_public_key = fs
    .readFileSync(masterPublicKeyFilePath, 'utf8')
    .toString();

  try {
    await ndid.initNDID({
      public_key,
      master_public_key,
    });
    await Promise.all(
      nodes.map(({ nodeId, role }) => addKeyAndSetToken(nodeId, role))
    );
    await Promise.all(
      nodesBehindProxy.map(({ nodeId, role }) =>
        addKeyAndSetToken(nodeId, role, true)
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
    console.log('========= Done =========');
  } catch (error) {
    console.error('Cannot initialize NDID platform:', error);
  }

  process.exit();
}

init();
