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

import * as tendermintNdid from '../../tendermint/ndid';
import { callbackToClient } from '../../callback';
import { getFunction } from '../../functions';
import CustomError from 'ndid-error/custom_error';
import logger from '../../logger';

export async function handleIdentityChangeTransactions({
  nodeId,
  getCallbackUrlFnName,
  transaction,
}) {
  if (nodeId === transaction.node_id) {
    return;
  }

  const referenceGroupCode = Buffer.from(
    transaction.deliverTxResult.reference_group_code,
    'base64'
  ).toString();
  // Check if associated with nodeId
  const identityInfo = await tendermintNdid.getIdentityInfo({
    reference_group_code: referenceGroupCode,
  });
  if (identityInfo == null) {
    return;
  }

  let action;
  if (transaction.fnName === 'RegisterIdentity') {
    action = 'create_identity';
  } else if (transaction.fnName === 'AddAccessor') {
    action = 'add_accessor';
  } else if (transaction.fnName === 'RevokeAccessor') {
    action = 'revoke_accessor';
  } else if (transaction.fnName === 'RevokeIdentityAssociation') {
    action = 'revoke_identity_association';
  }
  notifyIdentityChange({
    getCallbackUrlFnName,
    nodeId,
    referenceGroupCode,
    action,
    actorNodeId: transaction.node_id,
  });
}

async function notifyIdentityChange({
  getCallbackUrlFnName,
  nodeId,
  referenceGroupCode,
  action,
  actorNodeId,
}) {
  logger.debug({
    message: 'Notifying identity change through callback',
  });
  try {
    const callbackUrl = await getFunction(getCallbackUrlFnName)();
    if (callbackUrl == null) {
      logger.warn({
        message: 'Identity change notification callback URL has not been set',
      });
      return;
    }
    await callbackToClient({
      getCallbackUrlFnName, // 'idp.getIdentityChangeNotificationCallbackUrl'
      body: {
        node_id: nodeId,
        type: 'identity_change_notification',
        reference_group_code: referenceGroupCode,
        action,
        actor_node_id: actorNodeId,
      },
      retry: true,
    });
  } catch (error) {
    const err = new CustomError({
      message: 'Error sending identity change notification callback',
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
