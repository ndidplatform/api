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
    await tendermint.transact(
      'InitNDID',
      { public_key, node_id: 'ndid1' },
      utils.getNonce()
    );
  } catch (error) {
    logger.error({
      message: 'Cannot init NDID',
      error,
    });
    throw error;
  }
}

export async function setNodeToken(data) {
  const { node_id, amount } = data;

  try {
    await tendermint.transact('SetNodeToken', data, utils.getNonce());
  } catch (error) {
    logger.error({
      message: 'Cannot set node token',
      error,
    });
    throw error;
  }
}

export async function addNodeToken(data) {
  const { node_id, amount } = data;

  try {
    await tendermint.transact('AddNodeToken', data, utils.getNonce());
  } catch (error) {
    logger.error({
      message: 'Cannot add node token',
      error,
    });
    throw error;
  }
}

export async function reduceNodeToken(data) {
  const { node_id, amount } = data;

  try {
    await tendermint.transact('ReduceNodeToken', data, utils.getNonce());
  } catch (error) {
    logger.error({
      message: 'Cannot reduce node token',
      error,
    });
    throw error;
  }
}

export async function registerNode(data) {
  const { node_id, public_key, role, max_ial, max_aal } = data;

  data.role = data.role.toUpperCase();
  if (data.role === 'IDP') data.role = 'IdP';

  try {
    await tendermint.transact('RegisterNode', data, utils.getNonce());
  } catch (error) {
    logger.error({
      message: 'Cannot register node',
      error,
    });
    throw error;
  }
}

export async function addNamespace({ namespace, description }) {
  try {
    await tendermint.transact(
      'AddNamespace',
      { namespace, description },
      utils.getNonce()
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function deleteNamespace({ namespace }) {
  try {
    await tendermint.transact(
      'DeleteNamespace',
      { namespace },
      utils.getNonce()
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}