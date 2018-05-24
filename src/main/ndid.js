import logger from '../logger';

import * as utils from '../utils';
import * as config from '../config';
import * as tendermint from '../tendermint/ndid';

let init = false;

export async function initNDID(public_key) {
  if (init) {
    logger.error({
      message: 'NDID is already exist',
    });
    return false;
  }
  try {
    const { success } = await tendermint.transact(
      'InitNDID',
      { public_key, node_id: 'ndid1' },
      utils.getNonce()
    );
    return success;
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function setNodeToken(data) {
  const { node_id, amount } = data;

  try {
    const { success } = await tendermint.transact(
      'SetNodeToken',
      data,
      utils.getNonce()
    );
    return success;
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function addNodeToken(data) {
  const { node_id, amount } = data;

  try {
    const { success } = await tendermint.transact(
      'AddNodeToken',
      data,
      utils.getNonce()
    );
    return success;
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function reduceNodeToken(data) {
  const { node_id, amount } = data;

  try {
    const { success } = await tendermint.transact(
      'ReduceNodeToken',
      data,
      utils.getNonce()
    );
    return success;
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function registerNode(data) {
  const { node_id, public_key, role, max_ial, max_aal } = data;

  data.role = data.role.toUpperCase();
  if (data.role === 'IDP') data.role = 'IdP';

  try {
    const { success } = await tendermint.transact(
      'RegisterNode',
      data,
      utils.getNonce()
    );
    return success;
  } catch (error) {
    // TODO:
    throw error;
  }
}
