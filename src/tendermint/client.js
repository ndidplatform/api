import fetch from 'node-fetch';

import { TENDERMINT_ADDRESS } from '../config';

export async function abciQuery(data) {
  const base64Encoded = Buffer.from(data).toString('base64');

  const uriEncoded = encodeURIComponent(base64Encoded);

  try {
    const response = await fetch(
      `http://${TENDERMINT_ADDRESS}/abci_query?data="${uriEncoded}"`
    );
    const responseJson = await response.json();
    return responseJson;
  } catch (error) {
    console.error('Cannot connect to tendermint HTTP endpoint', error);
    throw error;
  }
}

export async function broadcastTxCommit(tx) {
  const base64Encoded = Buffer.from(tx).toString('base64');

  const uriEncoded = encodeURIComponent(base64Encoded);

  try {
    const response = await fetch(
      `http://${TENDERMINT_ADDRESS}/broadcast_tx_commit?tx="${uriEncoded}"`
    );
    const responseJson = await response.json();
    return responseJson;
  } catch (error) {
    console.error('Cannot connect to tendermint HTTP endpoint', error);
    throw error;
  }
}
