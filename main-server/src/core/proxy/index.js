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

import {
  getNodesBehindProxyWithKeyOnProxy,
  invalidateNodesBehindProxyWithKeyOnProxyCache,
} from '../../node';

import * as config from '../../config';

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

  if (role === 'rp') {
    return rp.handleMessageFromQueue(messageId, message, receiverNodeId);
  } else if (role === 'idp') {
    return idp.handleMessageFromQueue(messageId, message, receiverNodeId);
  } else if (role === 'as') {
    return as.handleMessageFromQueue(messageId, message, receiverNodeId);
  }
}

export async function handleTendermintNewBlock(
  fromHeight,
  toHeight,
  parsedTransactionsInBlocks
) {
  await processTasksInBlocks(parsedTransactionsInBlocks);
  const nodesBehindProxyWithKeyOnProxy = await getNodesBehindProxyWithKeyOnProxy();
  await Promise.all(
    nodesBehindProxyWithKeyOnProxy.map((node) => {
      let { node_id, role } = node;
      role = role.toLowerCase();
      if (role === 'rp') {
        return rp.handleTendermintNewBlock(
          fromHeight,
          toHeight,
          parsedTransactionsInBlocks,
          node_id
        );
      } else if (role === 'idp') {
        return idp.handleTendermintNewBlock(
          fromHeight,
          toHeight,
          parsedTransactionsInBlocks,
          node_id
        );
      } else if (role === 'as') {
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

async function processTasksInBlocks(parsedTransactionsInBlocks) {
  const nodesBehindProxyWithKeyOnProxy = await getNodesBehindProxyWithKeyOnProxy();

  parsedTransactionsInBlocks.forEach(({ transactions }) => {
    transactions.forEach((transaction) => {
      if (transaction.fnName === 'UpdateNode') {
        const childNode = nodesBehindProxyWithKeyOnProxy.find(
          (node) => node.node_id === transaction.nodeId
        );
        if (childNode != null) {
          invalidateNodesBehindProxyWithKeyOnProxyCache();
        }
      }
      if (
        transaction.fnName === 'AddNodeToProxyNode' ||
        transaction.fnName === 'UpdateNodeProxyNode'
      ) {
        if (config.nodeId === transaction.args.proxy_node_id) {
          invalidateNodesBehindProxyWithKeyOnProxyCache();
        }
      }
      if (
        transaction.fnName === 'UpdateNodeByNDID' ||
        transaction.fnName === 'RemoveNodeFromProxyNode' ||
        transaction.fnName === 'UpdateNodeProxyNode'
      ) {
        const childNode = nodesBehindProxyWithKeyOnProxy.find(
          (node) => node.node_id === transaction.args.node_id
        );
        if (childNode != null) {
          invalidateNodesBehindProxyWithKeyOnProxyCache();
        }
      }
    });
  });
}
