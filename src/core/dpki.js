import logger from '../logger';

import * as utils from '../utils';
import * as config from '../config';
import * as tendermint from '../tendermint/ndid';

export async function updateNode({ public_key, master_public_key }) {
  try {
    const { success } = await tendermint.transact(
      'UpdateNode',
      {
        public_key,
        master_public_key,
      },
      utils.getNonce(),
      true
    );
    return success;
  } catch (error) {
    // TODO:
    throw error;
  }
}
