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

import express from 'express';

import * as tendermint from '../../tendermint';
import * as tendermintNdid from '../../tendermint/ndid';
import * as common from '../../core/common';
import * as mq from '../../mq';
import * as mqService from '../../mq/grpc_client';
import * as callbackUtil from '../../callback';
import * as externalCryptoService from '../../external_crypto_service';
import * as config from '../../config';
import logger from '../../logger';

import { version } from '../../version';

const router = express.Router();

router.get('/info', async function getInfo(req, res, next) {
  try {
    let nodeInfo;
    if (tendermint.connected) {
      nodeInfo = await tendermintNdid.getNodeInfo(config.nodeId);
    }

    let mqServiceServerInfo;
    try {
      mqServiceServerInfo = await mqService.getInfo();
    } catch (error) {
      logger.warn({
        message: 'Cannot get MQ service server info',
        err: error,
      });
    }

    res.status(200).json({
      env: config.env,
      version: version == null ? null : version,
      api_version: '6.0', // Latest API spec version
      node_id: config.nodeId,
      node_name: nodeInfo != null ? nodeInfo.node_name : undefined,
      node_public_key: nodeInfo != null ? nodeInfo.public_key : undefined,
      role: nodeInfo != null ? nodeInfo.role : undefined,
      server_listen_port: config.serverPort,
      db_ip: config.dbIp,
      db_port: config.dbPort,
      message_queue_ip: config.mqIp,
      message_queue_port: config.mqPort,
      message_queue_service_server: {
        ip: config.mqServiceServerIp,
        port: config.mqServiceServerPort,
        server_info:
          mqServiceServerInfo != null
            ? {
                node_id: mqServiceServerInfo.node_id,
                message_queue_port: mqServiceServerInfo.mq_binding_port,
              }
            : null,
      },
      tendermint_address: config.tendermintAddress,
      tendermint_web_socket_connected: tendermint.connected,
      last_known_chain_id: tendermint.chainId,
      last_known_block_height: tendermint.latestBlockHeight,
    });
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/num_expected_txs', (req, res) => {
  res.status(200).json({
    n_expected_txs: tendermint.getExpectedTxsCount(),
  });
});

router.get('/expected_txs', (req, res) => {
  res.status(200).json({
    expected_txs: tendermint.getExpectedTxHashes(),
  });
});

// Outbound MQ messages that have not received ACK from destination
router.get('/num_pending_outbound_mq_messages', (req, res) => {
  res.status(200).json({
    n_pending_outbound_mq_messages: mq.getPendingOutboundMessagesCount(),
  });
});

// Pending callback calls that have not received response
router.get('/num_pending_client_callbacks', (req, res) => {
  res.status(200).json({
    n_pending_client_callbacks: callbackUtil.getPendingCallbacksCount(),
  });
});

// Pending callback to external decrypt and sign that have not received response
router.get('/num_pending_external_crypto_callbacks', (req, res) => {
  res.status(200).json({
    n_pending_external_crypto_callbacks: externalCryptoService.getPendingCallbacksCount(),
  });
});

router.get('/num_processing_blocks', (req, res) => {
  res.status(200).json({
    n_processing_blocks: tendermint.getProcessingBlocksCount(),
  });
});

router.get('/processing_blocks', (req, res) => {
  res.status(200).json({
    processing_blocks: tendermint.getProcessingBlocks(),
  });
});

router.get('/num_processing_inbound_messages', (req, res) => {
  res.status(200).json({
    n_processing_inbound_messages: common.getProcessingInboundMessagesCount(),
  });
});

export default router;
