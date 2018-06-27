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

import path from 'path';
import fs from 'fs';

import * as tendermintNdid from '../tendermint/ndid';
import * as config from '../config';
import logger from '../logger';

let version;

export default async function getInfo(req, res, next) {
  const nodeInfo = await tendermintNdid.getNodeInfo(config.nodeId);

  res.status(200).json({
    env: config.env,
    version: version == null ? null : version,
    apiVersion: '1.0',
    nodeId: config.nodeId,
    nodeName: nodeInfo != null ? nodeInfo.node_name : undefined,
    nodePublicKey: nodeInfo != null ? nodeInfo.public_key : undefined,
    role: nodeInfo != null ? nodeInfo.role : undefined,
    serverListenPort: config.serverPort,
    messageQueueIp: config.mqRegister.ip,
    messageQueuePort: config.mqRegister.port,
    tendermintAddress: config.tendermintAddress,
  });
}

fs.readFile(
  path.join(__dirname, '..', '..', 'VERSION'),
  'utf8',
  (err, data) => {
    if (err) {
      logger.error({
        message: 'Unable to read VERSION file',
        err,
      });
    }
    version = data;
  }
);
