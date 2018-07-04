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

import * as utils from '../utils';
import * as tendermint from '../tendermint';
import logger from '../logger';
import { callbackToClient } from '../utils/callback';

import CustomError from '../error/customError';
import { getErrorObjectForClient } from '../error/helpers';

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

export async function registerNode(data, { synchronous = false } = {}) {
  try {
    if (synchronous) {
      await registerNodeInternalAsync(...arguments);
    } else {
      registerNodeInternalAsync(...arguments);
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot register node',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function registerNodeInternalAsync(data, { synchronous = false } = {}) {
  const {
    reference_id,
    callback_url,
    node_id,
    public_key,
    role,
    max_ial,
    max_aal,
    node_name,
    master_public_key,
  } = data;

  data.role = data.role.toUpperCase();
  if (data.role === 'IDP') data.role = 'IdP';

  try {
    await tendermint.transact('RegisterNode', data, utils.getNonce());

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'create_node_result',
          reference_id,
          success: true,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: 'Update node internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'create_node_result',
          reference_id,
          success: false,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

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

export async function updateService({ service_id, service_name }) {
  try {
    await tendermint.transact(
      'UpdateService',
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

export async function setValidator({ public_key, power }) {
  try {
    await tendermint.transact(
      'SetValidator',
      { public_key, power },
      utils.getNonce()
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}
