import express from 'express';
import bodyParser from 'body-parser';

import * as rp from './rp';
import * as idp from './idp';
import * as as from './as';
import * as utils from './utils';
import { role } from '../config';

/*
  data = { requestId }
*/
export async function getRequest(data) {
  return await utils.queryChain('GetRequest', data);
}

/*
  data = { node_id, public_key }
*/
export async function addNodePubKey(data) {
  let result = await utils.updateChain(
    'AddNodePublicKey',
    data,
    utils.getNonce()
  );
  return result;
}

/*
  node_id
*/
export async function getNodePubKey(node_id) {
  return await utils.queryChain('GetNodePublicKey', { node_id });
}

export async function setSignatureCallback(url) {
  await utils.setSignatureCallback(url);
}

// Listen for callbacks (events) from ABCI app
const app = express();
const ABCI_APP_CALLBACK_PORT = process.env.ABCI_APP_CALLBACK_PORT || 3001;
const ABCI_APP_CALLBACK_PATH =
  process.env.ABCI_APP_CALLBACK_PATH || '/callback';

app.use(bodyParser.json({ limit: '2mb' }));

app.post(ABCI_APP_CALLBACK_PATH, (req, res) => {
  const { requestId } = req.body;

  let handleABCIAppCallback;
  if (role === 'rp') {
    handleABCIAppCallback = rp.handleABCIAppCallback;
  } else if (role === 'idp') {
    handleABCIAppCallback = idp.handleABCIAppCallback;
  } else if (role === 'as') {
    handleABCIAppCallback = as.handleABCIAppCallback;
  }

  if (handleABCIAppCallback) {
    handleABCIAppCallback(requestId);
  }

  res.status(200).end();
});

app.listen(ABCI_APP_CALLBACK_PORT, () =>
  console.log(
    `Listening to ABCI app callbacks on port ${ABCI_APP_CALLBACK_PORT}`
  )
);
