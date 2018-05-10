// For development use only

import fs from 'fs';
import path from 'path';

import * as abciAppNdid from './main/ndid';

async function addKey(role, index) {
  const node_id = role + index.toString();
  const filePath = path.join(__dirname, '..', 'devKey', role, node_id + '.pub');
  const public_key = fs.readFileSync(filePath, 'utf8').toString();

  await abciAppNdid.registerNode({
    node_id,
    public_key,
    role,
  });
}

export async function init() {
  console.log('========= Initializing keys for development =========');

  const filePath = path.join(__dirname, '..', 'devKey', 'ndid', 'ndid1.pub');
  const public_key = fs.readFileSync(filePath, 'utf8').toString();

  const result = await abciAppNdid.initNDID(public_key);
  if (!result) {
    console.error('Cannot initialize NDID master key', result);
  } else {
    let promiseArr = [];
    ['rp', 'idp', 'as'].forEach(async (role) => {
      promiseArr.push(addKey(role, 1));
      promiseArr.push(addKey(role, 2));
      promiseArr.push(addKey(role, 3));
    });
    await Promise.all(promiseArr);
    console.log('========= Keys for development initialized =========');
  }

  process.exit();
}

init();
