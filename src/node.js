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

import * as tendermintNdid from './tendermint/ndid';

import CustomError from './error/custom_error';

import * as config from './config';

export let role;

let nodesBehindProxyWithKeyOnProxy;

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

export async function getNodesBehindProxyFromBlockchain({ withConfig } = {}) {
  if (role == null) {
    throw new CustomError({
      message: 'Need to run "getNodeRoleFromBlockchain()" first',
    });
  }
  if (role !== 'proxy') {
    throw new CustomError({
      message: 'This node is not a proxy node',
      details: {
        role,
      },
    });
  }
  try {
    const nodesBehindProxy = await tendermintNdid.getNodesBehindProxyNode(
      config.nodeId
    );
    if (withConfig != null) {
      return nodesBehindProxy.filter((node) => node.config === withConfig);
    } else {
      return nodesBehindProxy;
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get nodes behind proxy from blockchain',
      cause: error,
    });
  }
}

export async function getNodesBehindProxyWithKeyOnProxy() {
  if (nodesBehindProxyWithKeyOnProxy == null) {
    nodesBehindProxyWithKeyOnProxy = await getNodesBehindProxyFromBlockchain({
      withConfig: 'KEY_ON_PROXY',
    });
  }
  return nodesBehindProxyWithKeyOnProxy;
}

export function invalidateNodesBehindProxyWithKeyOnProxyCache() {
  nodesBehindProxyWithKeyOnProxy = null;
}
