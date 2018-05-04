import * as utils from './utils';
import * as config from '../config';

var init = false;

export async function initNDID(public_key) {
  if(init) {
    console.error('NDID already exist.');
    return false;
  }
  init = await utils.updateChain(
    'InitNDID',
    { public_key },
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
  return await utils.updateChain(
    'RegisterNode',
    data,
    utils.getNonce()
  );
}