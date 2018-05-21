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
  const [ result, height ] = await tendermint.transact(
    'InitNDID',
    { public_key, node_id: 'ndid1' },
    utils.getNonce()
  );
  init = result;
  return init;
}

export async function setNodeToken(data) {
  const { node_id, amount } = data;

  const result = await tendermint.transact('SetNodeToken', data, utils.getNonce());
  return result[0];
}

export async function addNodeToken(data) {
  const { node_id, amount } = data;

  const result = await tendermint.transact('AddNodeToken', data, utils.getNonce());
  return result[0];
}

export async function reduceNodeToken(data) {
  const { node_id, amount } = data;

  const result = await tendermint.transact('ReduceNodeToken', data, utils.getNonce());
  return result[0];
}

export async function registerNode(data) {
  const { node_id, public_key, role } = data;

  data.role = data.role.toUpperCase();
  if (data.role === 'IDP') data.role = 'IdP';

  const result = await tendermint.transact('RegisterNode', data, utils.getNonce());
  return result[0];
}
