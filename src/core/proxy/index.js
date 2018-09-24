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
