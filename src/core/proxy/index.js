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

import * as tendermintNdid from '../../tendermint/ndid';
import { getNodesBehindProxyFromBlockchain } from '../../node';

export async function handleMessageFromQueue(message, receiverNodeId) {
  const nodeInfo = await tendermintNdid.getNodeInfo(receiverNodeId);
  const role = nodeInfo.role.toLowerCase();
  // TODO: cache node role in memory for faster later use,
  // but how do we invalidate cache when node behind proxy is no longer
  // behind a proxy?

  if (role === 'rp') {
    return rp.handleMessageFromQueue(message, receiverNodeId);
  } else if (role === 'idp') {
    return idp.handleMessageFromQueue(message, receiverNodeId);
  } else if (role === 'as') {
    return as.handleMessageFromQueue(message, receiverNodeId);
  }
}

export async function handleTendermintNewBlock(
  fromHeight,
  toHeight,
  parsedTransactionsInBlocks
) {
  const nodesBehindProxyWithKeyOnProxy = await getNodesBehindProxyFromBlockchain(
    { withConfig: 'KEY_ON_PROXY' }
  );
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
