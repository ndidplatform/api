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

import Prometheus from 'prom-client';

import * as tendermint from './tendermint';
import * as common from './core/common';
import * as mq from './mq';
import * as callbackUtil from './utils/callback';
import * as externalCryptoService from './utils/external_crypto_service';

const defaultMetricsInterval = Prometheus.collectDefaultMetrics();

export const httpRequestDurationMicroseconds = new Prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
});

const expectedTxsTotal = new Prometheus.Gauge({
  name: 'expected_txs_total',
  help: 'Number of expected Txs (waiting to be included in a block)',
});

const pendingOutboundMqMessagesTotal = new Prometheus.Gauge({
  name: 'pending_outbound_mq_messages_total',
  help:
    'Number of outbound MQ messages that have not been ACKed by destinations',
});

const pendingClientCallbacksTotal = new Prometheus.Gauge({
  name: 'pending_client_callbacks_total',
  help: 'Number of callbacks to client waiting to be sent (includes retries)',
});

const pendingExternalCryptoCallbacksTotal = new Prometheus.Gauge({
  name: 'pending_external_crypto_callbacks_total',
  help:
    'Number of callbacks to external crypto service waiting to be sent (includes retries)',
});

const processingBlocksTotal = new Prometheus.Gauge({
  name: 'processing_blocks_total',
  help: 'Number of processing blocks',
});

const processingInboundMqMessages = new Prometheus.Gauge({
  name: 'processing_inbound_mq_messages_total',
  help: 'Number of processing inbound MQ messages',
});

tendermint.metricsEventEmitter.on('expectedTxsCount', (expectedTxsCount) =>
  expectedTxsTotal.set(expectedTxsCount)
);
mq.metricsEventEmitter.on(
  'pendingOutboundMessagesCount',
  (pendingOutboundMessagesCount) =>
    pendingOutboundMqMessagesTotal.set(pendingOutboundMessagesCount)
);
callbackUtil.metricsEventEmitter.on(
  'pendingCallbacksCount',
  (pendingCallbacksCount) =>
    pendingClientCallbacksTotal.set(pendingCallbacksCount)
);
externalCryptoService.metricsEventEmitter.on(
  'pendingCallbacksCount',
  (pendingCallbacksCount) =>
    pendingExternalCryptoCallbacksTotal.set(pendingCallbacksCount)
);
tendermint.metricsEventEmitter.on(
  'processingBlocksCount',
  (processingBlocksCount) => processingBlocksTotal.set(processingBlocksCount)
);
common.metricsEventEmitter.on(
  'processingInboundMessagesCount',
  (processingInboundMessagesCount) =>
    processingInboundMqMessages.set(processingInboundMessagesCount)
);

export function stopCollectDefaultMetrics() {
  clearInterval(defaultMetricsInterval);
}
