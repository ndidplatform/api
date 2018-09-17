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

import * as tendermintNdid from '../tendermint/ndid';
import { validateKey } from '../utils/node_key';
import logger from '../logger';
import { callbackToClient } from '../utils/callback';
import { getErrorObjectForClient } from '../error/helpers';

export async function updateNode(
  {
    reference_id,
    callback_url,
    public_key,
    public_key_type,
    master_public_key,
    master_public_key_type,
  },
  { synchronous = false } = {}
) {
  // Validate public keys
  if (public_key != null) {
    validateKey(public_key, public_key_type);
  }

  if (master_public_key != null) {
    validateKey(master_public_key, master_public_key_type);
  }

  if (synchronous) {
    await updateNodeInternalAsync(...arguments);
  } else {
    updateNodeInternalAsync(...arguments);
  }
}

async function updateNodeInternalAsync(
  { reference_id, callback_url, public_key, master_public_key },
  { synchronous = false } = {}
) {
  try {
    await tendermintNdid.updateNode({ public_key, master_public_key });

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
