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

import * as rp from '../rp';
import * as idp from '../idp';
import * as as from '../as';

import { getNodesBehindProxyWithKeyOnProxy } from '../../node';

import ROLE from '../../role';

export async function handleMessageFromQueue(
  messageId,
  message,
  receiverNodeId
) {
  const nodesBehindProxyWithKeyOnProxy = await getNodesBehindProxyWithKeyOnProxy();
  const node = nodesBehindProxyWithKeyOnProxy.find(
    (node) => node.node_id === receiverNodeId
  );
  if (node == null) return;

  const role = node.role.toLowerCase();

  if (role === ROLE.RP) {
    return rp.handleMessageFromQueue(messageId, message, receiverNodeId);
  } else if (role === ROLE.IDP) {
    return idp.handleMessageFromQueue(messageId, message, receiverNodeId);
  } else if (role === ROLE.AS) {
    return as.handleMessageFromQueue(messageId, message, receiverNodeId);
  }
}

export async function handleTendermintNewBlock(
  fromHeight,
  toHeight,
  parsedTransactionsInBlocks
) {
  const nodesBehindProxyWithKeyOnProxy = await getNodesBehindProxyWithKeyOnProxy();
  await Promise.all(
    nodesBehindProxyWithKeyOnProxy.map((node) => {
      let { node_id, role } = node;
      role = role.toLowerCase();
      if (role === ROLE.RP) {
        return rp.handleTendermintNewBlock(
          fromHeight,
          toHeight,
          parsedTransactionsInBlocks,
          node_id
        );
      } else if (role === ROLE.IDP) {
        return idp.handleTendermintNewBlock(
          fromHeight,
          toHeight,
          parsedTransactionsInBlocks,
          node_id
        );
      } else if (role === ROLE.AS) {
        return as.handleTendermintNewBlock(
          fromHeight,
          toHeight,
          parsedTransactionsInBlocks,
          node_id
        );
      }
    })
  );
}
