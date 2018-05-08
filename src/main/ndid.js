import * as utils from './utils';
import * as config from '../config';
import * as tendermint from '../tendermint/ndid';

var init = false;

export async function initNDID(public_key) {
  if(init) {
    console.error('NDID already exist.');
    return false;
  }
  init = await tendermint.transact(
    'InitNDID',
    { public_key, node_id: 'ndid' },
    utils.getNonce()
  );
  return init;
}

export async function registerNode(data) {
  const {
    node_id,
    public_key,
    role
  } = data;
  return await tendermint.transact(
    'RegisterNode',
    data,
    utils.getNonce()
  );
}