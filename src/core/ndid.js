/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 * 
 * This file is part of NDID software.
 * 
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 * 
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 * 
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 * 
 * Please contact info@ndid.co.th for any further questions
 * 
 */

import logger from '../logger';

import * as utils from '../utils';
import * as config from '../config';
import * as tendermint from '../tendermint';

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
  const { 
    node_id, 
    public_key, 
    role, 
    max_ial, 
    max_aal, 
    node_name, 
    master_public_key 
  } = data;

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

export async function addService({ service_id, service_name }) {
  try {
    await tendermint.transact(
      'AddService',
      { service_id, service_name },
      utils.getNonce()
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}

export async function deleteService({ service_id }) {
  try {
    await tendermint.transact(
      'DeleteService',
      { service_id },
      utils.getNonce()
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}