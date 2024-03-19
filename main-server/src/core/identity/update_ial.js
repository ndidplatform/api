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

import { getIdentityInfo } from '.';

import * as tendermintNdid from '../../tendermint/ndid';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import { callbackToClient } from '../../callback';
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
  if (role === 'proxy') {
    if (node_id == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    node_id = config.nodeId;
  }

  try {
    // check for created identity
    const identityOnNode = await getIdentityInfo({
      nodeId: node_id,
      namespace,
      identifier,
    });
    if (identityOnNode == null) {
      throw new CustomError({
        errorType: errorType.IDENTITY_NOT_FOUND_ON_IDP,
        details: {
          namespace,
          identifier,
        },
      });
    }

    const { supported_ial_list } = await tendermintNdid.getSupportedIALList();
    if (!supported_ial_list.includes(ial)) {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_IAL,
        details: {
          supported_ial_list,
          ial,
        },
      });
    }

    //check max_ial
    ial = parseFloat(ial);
    let { max_ial } = await tendermintNdid.getNodeInfo(node_id);
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
      await updateIalInternalAsync(...arguments, { nodeId: node_id });
    } else {
      updateIalInternalAsync(...arguments, { nodeId: node_id });
    }
  } catch (error) {
    const err = new CustomError({
      message: "Cannot update identity's IAL",
      cause: error,
    });
    logger.error({ err });
    throw err;
  }
}

async function updateIalInternalAsync(
  { reference_id, callback_url, namespace, identifier, ial },
  { synchronous = false } = {},
  { nodeId }
) {
  try {
    if (!synchronous) {
      await tendermintNdid.updateIdentity(
        { namespace, identifier, ial },
        nodeId,
        'identity.updateIalInternalAsyncAfterBlockchain',
        [{ nodeId, reference_id, callback_url }, { synchronous }]
      );
    } else {
      await tendermintNdid.updateIdentity({ namespace, identifier, ial }, nodeId);
      await updateIalInternalAsyncAfterBlockchain(
        {},
        { nodeId, reference_id, callback_url },
        { synchronous }
      );
    }
  } catch (error) {
    logger.error({
      message: "Update identity's IAL internal async error",
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'update_ial_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    }

    throw error;
  }
}

export async function updateIalInternalAsyncAfterBlockchain(
  { error },
  { nodeId, reference_id, callback_url },
  { synchronous = false } = {}
) {
  try {
    if (error) throw error;

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'update_ial_result',
          success: true,
          reference_id,
        },
        retry: true,
      });
    }
  } catch (error) {
    logger.error({
      message: "Update identity's IAL internal async after blockchain error",
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'update_ial_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    } else {
      throw error;
    }
  }
}
