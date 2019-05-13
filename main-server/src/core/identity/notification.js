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

import operationTypes from './operation_type';

import * as tendermintNdid from '../../tendermint/ndid';
import { callbackToClient } from '../../callback';
import { getFunction } from '../../functions';
import CustomError from 'ndid-error/custom_error';
import logger from '../../logger';

const reference_group_code_base64 = Buffer.from(
  'reference_group_code'
).toString('base64');

export async function handleIdentityModificationTransactions({
  nodeId,
  getCallbackUrlFnName,
  transaction,
}) {
  if (nodeId === transaction.nodeId) {
    return;
  }

  const referenceGroupCode = Buffer.from(
    transaction.deliverTxResult.tags.find(
      (tag) => tag.key === reference_group_code_base64
    ).value,
    'base64'
  ).toString();
  // Check if associated with nodeId
  const identityInfo = await tendermintNdid.getIdentityInfo({
    reference_group_code: referenceGroupCode,
    node_id: nodeId,
  });
  if (identityInfo == null) {
    return;
  }

  let action;
  if (transaction.fnName === operationTypes.REGISTER_IDENTITY) {
    action = 'create_identity';
  } else if (transaction.fnName === operationTypes.ADD_IDENTITY) {
    action = 'add_identity';
  } else if (transaction.fnName === operationTypes.ADD_ACCESSOR) {
    action = 'add_accessor';
  } else if (transaction.fnName === operationTypes.REVOKE_ACCESSOR) {
    action = 'revoke_accessor';
  } else if (transaction.fnName === operationTypes.REVOKE_AND_ADD_ACCESSOR) {
    action = 'revoke_and_add_accessor';
  } else if (
    transaction.fnName === operationTypes.REVOKE_IDENTITY_ASSOCIATION
  ) {
    action = 'revoke_identity_association';
  } else if (transaction.fnName === operationTypes.UPDATE_IDENTITY_MODE_LIST) {
    action = 'upgrade_identity_mode';
  }
  notifyIdentityModification({
    getCallbackUrlFnName,
    nodeId,
    referenceGroupCode,
    action,
    actorNodeId: transaction.nodeId,
  });
}

async function notifyIdentityModification({
  getCallbackUrlFnName,
  nodeId,
  referenceGroupCode,
  action,
  actorNodeId,
}) {
  logger.debug({
    message: 'Notifying identity modification/change through callback',
  });
  try {
    const callbackUrl = await getFunction(getCallbackUrlFnName)();
    if (callbackUrl == null) {
      logger.warn({
        message:
          'Identity modification notification callback URL has not been set',
      });
      return;
    }
    await callbackToClient({
      getCallbackUrlFnName, // 'idp.getIdentityModificationNotificationCallbackUrl'
      body: {
        node_id: nodeId,
        type: 'identity_modification_notification',
        reference_group_code: referenceGroupCode,
        action,
        actor_node_id: actorNodeId,
      },
      retry: true,
    });
  } catch (error) {
    const err = new CustomError({
      message:
        'Error sending identity modification/change notification callback',
      cause: error,
      details: {
        nodeId,
        referenceGroupCode,
        action,
        actorNodeId,
      },
    });
    logger.error({ err });
  }
}
