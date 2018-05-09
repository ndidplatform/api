import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

import * as config from '../config';

async function addKey(role, index) {
  let node_id = role + index.toString();
  let filePath = path.join(__dirname, '..', 'devKey', role, node_id + '.pub');
  await fetch(`http://localhost:${config.serverPort}/ndid/registerNode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      public_key: fs.readFileSync(filePath,'utf8').toString(),
      node_id,
      role
    })
  });
}

export async function init() {
  let filePath = path.join(__dirname, '..', 'devKey', 'ndid', 'ndid1.pub');
  let response = await fetch(`http://localhost:${config.serverPort}/ndid/initNDID`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      public_key: fs.readFileSync(filePath,'utf8').toString()
    })
  });
  let [result, height] = await response.json();
  if(!result) {
    console.error('Cannot initialize NDID master key',result);
    process.exit();
  }

  let promiseArr = [];
  ['rp','idp','as'].forEach(async (role) => {
    promiseArr.push(addKey(role, 1));
    promiseArr.push(addKey(role, 2));
    promiseArr.push(addKey(role, 3));
  });
  await Promise.all(promiseArr);
  console.log('Key initialize done');
  process.exit();
}