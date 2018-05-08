import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

import * as config from '../config';

async function addKey(role, index) {
  let node_id = role + index.toString();
  let filePath = path.join(__dirname, '..', 'devKey', role, node_id + '.pub');
  fetch(`http://localhost:${config.serverPort}/ndid/registerNode`, {
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
  let filePath = path.join(__dirname, '..', 'devKey', 'ndid', 'ndid.pub');
  let response = await fetch(`http://localhost:${config.serverPort}/ndid/initNDID`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      public_key: fs.readFileSync(filePath,'utf8').toString()
    })
  });
  let result = await response.text();
  if(result !== 'true') {
    console.error('Cannot initialize NDID master key',result);
    return;
  }

  ['rp','idp','as'].forEach(async (role) => {
    await Promise.all([
      addKey(role, 1),
      addKey(role, 2),
      addKey(role, 3)
    ]);
    console.log('Key initialize done');
    process.exit();
  });
}