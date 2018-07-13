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
import * as tendermint from './tendermint/ndid';
import * as config from './config';

// Make sure data and log directories exist
mkdirp.sync(config.dataDirectoryPath);
mkdirp.sync(config.logDirectoryPath);

async function addKeyAndSetToken(role, index) {
  const node_id = role + index.toString();
  const node_name = ''; //all anonymous
  const filePath = path.join(
    __dirname,
    '..',
    'dev_key',
    role,
    node_id + '.pub'
  );
  const public_key = fs.readFileSync(filePath, 'utf8').toString();
  const masterFilePath = path.join(
    __dirname,
    '..',
    'dev_key',
    role,
    node_id + '_master.pub'
  );
  const master_public_key = fs.readFileSync(masterFilePath, 'utf8').toString();

  await ndid.registerNode(
    {
      node_id,
      node_name,
      public_key,
      master_public_key,
      role,
      max_ial: 3,
      max_aal: 3,
    },
    { synchronous: true }
  );

  await ndid.setNodeToken({
    node_id,
    amount: 1000,
  });
}

export async function init() {
  console.log('========= Initializing keys for development =========');

  const publicKeyFilePath = path.join(
    __dirname,
    '..',
    'dev_key',
    'ndid',
    'ndid1.pub'
  );
  const masterPublicKeyFilePath = path.join(
    __dirname,
    '..',
    'dev_key',
    'ndid',
    'ndid1_master.pub'
  );
  const public_key = fs.readFileSync(publicKeyFilePath, 'utf8').toString();
  const master_public_key = fs
    .readFileSync(masterPublicKeyFilePath, 'utf8')
    .toString();

  // Wait for blockchain ready
  await tendermint.ready;

  try {
    await ndid.initNDID({
      public_key,
      master_public_key,
    });
    let promiseArr = [];
    ['rp', 'idp', 'as'].forEach(async (role) => {
      promiseArr.push(addKeyAndSetToken(role, 1));
      promiseArr.push(addKeyAndSetToken(role, 2));
      promiseArr.push(addKeyAndSetToken(role, 3));
    });
    await Promise.all(promiseArr);
    console.log('========= Keys for development initialized =========');
    console.log('========= Adding namespaces and services =========');
    await ndid.addNamespace({
      namespace: 'cid',
      description: 'Thai citizen ID',
    });
    await ndid.addService({
      service_id: 'bank_statement',
      service_name: 'All transactions in the pass 3 month',
    });
    await Promise.all([
      ndid.approveService({
        node_id: 'as1',
        service_id: 'bank_statement',
      }),
      ndid.approveService({
        node_id: 'as2',
        service_id: 'bank_statement',
      }),
      ndid.approveService({
        node_id: 'as3',
        service_id: 'bank_statement',
      }),
    ]);
    console.log('========= Done =========');
  } catch (error) {
    console.error('Cannot initialize NDID master key', error);
  }

  process.exit();
}

init();
