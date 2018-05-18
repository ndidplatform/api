import logger from '../logger';

import * as utils from '../utils';
import * as config from '../config';
import * as tendermint from '../tendermint/ndid';

var init = false;

export async function initNDID(public_key) {
  if (init) {
    logger.error({
      message: 'NDID is already exist',
    });
    return false;
  }
  init = await tendermint.transact(
    'InitNDID',
    { public_key, node_id: 'ndid1' },
    utils.getNonce()
  );
  return init;
}

export async function setNodeToken(data) {
  const { node_id, amount } = data;

  return await tendermint.transact('SetNodeToken', data, utils.getNonce());
}

export async function addNodeToken(data) {
  const { node_id, amount } = data;

  return await tendermint.transact('AddNodeToken', data, utils.getNonce());
}

export async function reduceNodeToken(data) {
  const { node_id, amount } = data;

  return await tendermint.transact('ReduceNodeToken', data, utils.getNonce());
}

export async function registerNode(data) {
  const { node_id, public_key, role } = data;

  data.role = data.role.toUpperCase();
  if (data.role === 'IDP') data.role = 'IdP';

  return await tendermint.transact('RegisterNode', data, utils.getNonce());
}
