import * as tendermintNdid from './tendermint/ndid';

import CustomError from './error/custom_error';

import * as config from './config';

export let role;

export async function getNodeRoleFromBlockchain() {
  try {
    const nodeInfo = await tendermintNdid.getNodeInfo(config.nodeId);
    if (nodeInfo == null) {
      throw new CustomError({
        message:
          'Node info is not available. This node ID may have not been registered with NDID.',
      });
    }
    if (nodeInfo.role == null) {
      throw new CustomError({
        message: 'Role could not be found.',
      });
    }
    role = nodeInfo.role.toLowerCase();
    return role;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node role from blockchain',
      cause: error,
    });
  }
}
