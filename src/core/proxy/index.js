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
  error,
  height,
  missingBlockCount
) {
  const nodesBehindProxy = await getNodesBehindProxyFromBlockchain();
  // FIXME: filter out nodes that handle their own keys.
  const nodesBehindProxyWithKeyOnProxy = nodesBehindProxy;
  await Promise.all(
    nodesBehindProxyWithKeyOnProxy.map((node) => {
      let { node_id, role } = node;
      role = role.toLowerCase();
      if (role === 'rp') {
        return rp.handleTendermintNewBlock(
          error,
          height,
          missingBlockCount,
          node_id
        );
      } else if (role === 'idp') {
        return idp.handleTendermintNewBlock(
          error,
          height,
          missingBlockCount,
          node_id
        );
      } else if (role === 'as') {
        return as.handleTendermintNewBlock(
          error,
          height,
          missingBlockCount,
          node_id
        );
      }
    })
  );
}
