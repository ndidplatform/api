import logger from '../logger';

import * as utils from '../utils';
import * as config from '../config';
import * as tendermint from '../tendermint/ndid';

let init = false;

export async function updateNode(data) {
  const { 
    node_id, 
    public_key, 
    master_public_key,
  } = data;

  try {
    const { success } = await tendermint.transact(
      'UpdateNode',
      data,
      utils.getNonce(),
      true,
    );
    return success;
  } catch (error) {
    // TODO:
    throw error;
  }
}
