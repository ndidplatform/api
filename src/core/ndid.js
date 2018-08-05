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

import * as tendermint from '../tendermint';
import logger from '../logger';
import * as utils from '../utils';
import { callbackToClient } from '../utils/callback';

import CustomError from '../error/custom_error';
import { getErrorObjectForClient } from '../error/helpers';

let init = false;

export async function initNDID({
  public_key,
  public_key_type,
  master_public_key,
  master_public_key_type,
}) {
  if (init) {
    logger.error({
      message: 'NDID is already exist',
    });
    return false;
  }
  try {
    if (public_key != null) {
      utils.validateKey(public_key, public_key_type);
    }

    if (master_public_key != null) {
      utils.validateKey(master_public_key, master_public_key_type);
    }

    await tendermint.transact(
      'InitNDID',
      { node_id: 'ndid1', public_key, master_public_key },
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

export async function approveService({ node_id, service_id }) {
  try {
    await tendermint.transact(
      'RegisterServiceDestinationByNDID',
      { node_id, service_id },
      utils.getNonce()
    );
  } catch (error) {
    logger.error({
      message: 'Cannot approve service for AS',
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
    if (data.public_key != null) {
      utils.validateKey(data.public_key, data.public_key_type);
    }

    if (data.master_public_key != null) {
      utils.validateKey(data.master_public_key, data.master_public_key_type);
    }

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
    node_name,
    public_key,
    master_public_key,
    role,
    max_ial,
    max_aal,
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
      message: 'Register node internal async error',
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

export async function updateNode(data, { synchronous = false } = {}) {
  try {
    if (synchronous) {
      await updateNodeInternalAsync(...arguments);
    } else {
      updateNodeInternalAsync(...arguments);
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot update node',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function updateNodeInternalAsync(data, { synchronous = false } = {}) {
  const {
    reference_id,
    callback_url,
    node_id,
    node_name,
    // role,
    max_ial,
    max_aal,
  } = data;

  try {
    await tendermint.transact('UpdateNodeByNDID', data, utils.getNonce());

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'update_node_result',
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
          type: 'update_node_result',
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

export async function setTimeoutBlockRegisterMqDestination({
  blocks_to_timeout,
}) {
  try {
    await tendermint.transact(
      'SetTimeOutBlockRegisterMsqDestination',
      { time_out_block: blocks_to_timeout },
      utils.getNonce()
    );
  } catch (error) {
    // TODO:
    throw error;
  }
}
