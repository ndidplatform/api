// For development use only

import fs from 'fs';
import path from 'path';

import * as ndid from './core/ndid';
import * as tendermint from './tendermint/ndid';

async function addKeyAndSetToken(role, index) {
  const node_id = role + index.toString();
  const node_name = ''; //all anonymous
  const filePath = path.join(__dirname, '..', 'devKey', role, node_id + '.pub');
  const public_key = fs.readFileSync(filePath, 'utf8').toString();
  const masterFilePath = path.join(
    __dirname,
    '..',
    'devKey',
    role,
    node_id + '_master.pub'
  );
  const master_public_key = fs.readFileSync(masterFilePath, 'utf8').toString();

  await ndid.registerNode({
    node_id,
    node_name,
    public_key,
    master_public_key,
    role,
    max_ial: 3,
    max_aal: 3,
  });

  await ndid.setNodeToken({
    node_id,
    amount: 1000,
  });
}

export async function init() {
  console.log('========= Initializing keys for development =========');

  const filePath = path.join(__dirname, '..', 'devKey', 'ndid', 'ndid1.pub');
  const public_key = fs.readFileSync(filePath, 'utf8').toString();

  // Wait for blockchain ready
  await tendermint.ready;

  try {
    await ndid.initNDID(public_key);
    let promiseArr = [];
    ['rp', 'idp', 'as'].forEach(async (role) => {
      promiseArr.push(addKeyAndSetToken(role, 1));
      promiseArr.push(addKeyAndSetToken(role, 2));
      promiseArr.push(addKeyAndSetToken(role, 3));
    });
    await Promise.all(promiseArr);
    console.log('========= Keys for development initialized =========');
  } catch (error) {
    console.error('Cannot initialize NDID master key');
  }

  process.exit();
}

init();
