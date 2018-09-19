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

import { checkAssociated } from '.';

import * as tendermintNdid from '../../tendermint/ndid';

import CustomError from '../../error/custom_error';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';
import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

/**
 * Update identity's IAL
 *
 * @param {Object} updateIalParams
 * @param {string} updateIalParams.node_id
 * @param {string} updateIalParams.reference_id
 * @param {string} updateIalParams.callback_url
 * @param {string} updateIalParams.namespace
 * @param {string} updateIalParams.identifier
 * @param {number} updateIalParams.ial
 * @param {Object} options
 * @param {boolean} options.synchronous
 */
export async function updateIal(
  { node_id, reference_id, callback_url, namespace, identifier, ial },
  { synchronous = false } = {}
) {
  try {
    if (role === 'proxy' && node_id == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }

    // check for created identity
    if (!checkAssociated({ namespace, identifier })) {
      throw new CustomError({
        errorType: errorType.IDENTITY_NOT_FOUND,
        details: {
          namespace,
          identifier,
        },
      });
    }

    //check max_ial
    ial = parseFloat(ial);
    let { max_ial } = await tendermintNdid.getNodeInfo(config.nodeId);
    if (ial > max_ial) {
      throw new CustomError({
        errorType: errorType.MAXIMUM_IAL_EXCEED,
        details: {
          namespace,
          identifier,
        },
      });
    }

    if (synchronous) {
      await updateIalInternalAsync(...arguments);
    } else {
      updateIalInternalAsync(...arguments);
    }
  } catch (error) {
    const err = new CustomError({
      message: "Cannot update identity's IAL",
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function updateIalInternalAsync(
  { reference_id, callback_url, namespace, identifier, ial },
  { synchronous = false } = {}
) {
  try {
    const hash_id = utils.hash(namespace + ':' + identifier);
    if (!synchronous) {
      await tendermintNdid.updateIal(
        { hash_id, ial },
        null,
        'identity.updateIalInternalAsyncAfterBlockchain',
        [{ reference_id, callback_url }, { synchronous }]
      );
    } else {
      await tendermintNdid.updateIal({ hash_id, ial });
    }
  } catch (error) {
    logger.error({
      message: "Update identity's IAL internal async error",
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'update_ial_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}

export async function updateIalInternalAsyncAfterBlockchain(
  { error },
  { reference_id, callback_url },
  { synchronous = false } = {}
) {
  try {
    if (error) throw error;

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'update_ial_result',
          success: true,
          reference_id,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: "Update identity's IAL internal async after blockchain error",
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'update_ial_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    } else {
      throw error;
    }
  }
}
