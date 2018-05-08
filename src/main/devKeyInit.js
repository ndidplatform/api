import fetch from 'node-fetch';
import fs from 'fs';

import * as config from '../config';

async function addKey(role, index) {
  let node_id = role + index.toString();
  let filePath = role + '/' + node_id;
  fetch(`http://localhost:${config.serverPort}/ndid/registerNode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      public_key: fs.readFileSync('../devKey/' + filePath + '.pub','utf8').toString(),
      node_id,
      role
    })
  });
}

async function init() {
  let response = await fetch(process.env.API_ADDRESS + '/ndid/initNDID', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      public_key: fs.readFileSync('../devKey/ndid/ndid.pub','utf8').toString()
    })
  });
  if(await response.text() !== 'true') {
    console.error('Cannot initialize NDID master key');
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

init();