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

export const httpRequestDurationMilliseconds = new Prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
});

const expectedTxsTotal = new Prometheus.Gauge({
  name: 'expected_txs_total',
  help: 'Number of expected Txs (waiting to be included in a block)',
});

const txTransactFailsTotal = new Prometheus.Counter({
  name: 'tx_transact_fails_total',
  help: 'Total number of fail Tx transacts',
});

const txCommitDurationMilliseconds = new Prometheus.Histogram({
  name: 'tx_commit_duration_ms',
  help:
    'Duration of Tx from broadcast to commit (before transact to got Tx event) in ms',
  labelNames: ['function_name'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
});

const pendingOutboundMqMessagesTotal = new Prometheus.Gauge({
  name: 'pending_outbound_mq_messages_total',
  help:
    'Number of outbound MQ messages that have not been ACKed by destinations',
});

const outboundMqMessageFailsTotal = new Prometheus.Counter({
  name: 'outbound_mq_message_fails_total',
  help: 'Total number of fail outbound MQ message sendings',
});

const outboundMqMessageDurationMilliseconds = new Prometheus.Histogram({
  name: 'outbound_mq_message_duration_ms',
  help: 'Duration of MQ message sendings (from start to got ACK) in ms',
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
});

const pendingClientCallbacksTotal = new Prometheus.Gauge({
  name: 'pending_client_callbacks_total',
  help: 'Number of callbacks to client waiting to be sent (includes retries)',
});

const clientCallbackFailsTotal = new Prometheus.Counter({
  name: 'client_callback_fails_total',
  help: 'Total number of fail client callbacks',
});

const clientCallbackTimeoutsTotal = new Prometheus.Counter({
  name: 'client_callback_timeouts_total',
  help: 'Total number of timed out client callbacks',
});

const clientCallbackDurationMilliseconds = new Prometheus.Histogram({
  name: 'client_callback_duration_ms',
  help: 'Duration of client callbacks (from call to got response) in ms',
  labelNames: ['url', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
});

const pendingExternalCryptoCallbacksTotal = new Prometheus.Gauge({
  name: 'pending_external_crypto_callbacks_total',
  help:
    'Number of callbacks to external crypto service waiting to be sent (includes retries)',
});

const externalCryptoCallbackTimeoutsTotal = new Prometheus.Counter({
  name: 'external_crypto_callback_timeouts_total',
  help: 'Total number of fail timed out crypto callbacks',
});

const externalCryptoCallbackDurationMilliseconds = new Prometheus.Histogram({
  name: 'external_crypto_callback_duration_ms',
  help:
    'Duration of external crypto callbacks (from call to got response) in ms',
  labelNames: ['url', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
});

const processingBlocksTotal = new Prometheus.Gauge({
  name: 'processing_blocks_total',
  help: 'Number of processing blocks',
});

const blockProcessFailsTotal = new Prometheus.Counter({
  name: 'block_process_fails_total',
  help: 'Total number of fail block processes',
});

const blockProcessDurationMilliseconds = new Prometheus.Histogram({
  name: 'block_process_duration_ms',
  help: 'Duration of block processes in ms',
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
});

const processingInboundMqMessages = new Prometheus.Gauge({
  name: 'processing_inbound_mq_messages_total',
  help: 'Number of processing inbound MQ messages',
});

const inboundMqMessageProcessFailsTotal = new Prometheus.Counter({
  name: 'inbound_mq_message_process_fails_total',
  help: 'Total number of fail inbound MQ message processes',
});

const inboundMqMessageProcessDurationMilliseconds = new Prometheus.Histogram({
  name: 'inbound_mq_message_process_duration_ms',
  help: 'Duration of inbound MQ message processes in ms',
  labelNames: ['type'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500], // buckets for response time from 0.1ms to 500ms
});

tendermint.metricsEventEmitter.on('expectedTxsCount', (expectedTxsCount) =>
  expectedTxsTotal.set(expectedTxsCount)
);
tendermint.metricsEventEmitter.on('txTransactFail', () =>
  txTransactFailsTotal.inc()
);
tendermint.metricsEventEmitter.on(
  'txCommitDuration',
  (functionName, timeUsedInMs) =>
    txCommitDurationMilliseconds.labels(functionName).observe(timeUsedInMs)
);
mq.metricsEventEmitter.on(
  'pendingOutboundMessagesCount',
  (pendingOutboundMessagesCount) =>
    pendingOutboundMqMessagesTotal.set(pendingOutboundMessagesCount)
);
mq.metricsEventEmitter.on('mqSendMessageFail', () =>
  outboundMqMessageFailsTotal.inc()
);
mq.metricsEventEmitter.on('mqSendMessageTime', (timeUsedInMs) =>
  outboundMqMessageDurationMilliseconds.observe(timeUsedInMs)
);
callbackUtil.metricsEventEmitter.on(
  'pendingCallbacksCount',
  (pendingCallbacksCount) =>
    pendingClientCallbacksTotal.set(pendingCallbacksCount)
);
callbackUtil.metricsEventEmitter.on('callbackFail', () =>
  clientCallbackFailsTotal.inc()
);
callbackUtil.metricsEventEmitter.on('callbackTimedOut', () =>
  clientCallbackTimeoutsTotal.inc()
);
callbackUtil.metricsEventEmitter.on('callbackTime', (url, code, timeUsedInMs) =>
  clientCallbackDurationMilliseconds.labels(url, code).observe(timeUsedInMs)
);
externalCryptoService.metricsEventEmitter.on(
  'pendingCallbacksCount',
  (pendingCallbacksCount) =>
    pendingExternalCryptoCallbacksTotal.set(pendingCallbacksCount)
);
externalCryptoService.metricsEventEmitter.on('callbackTimedOut', () =>
  externalCryptoCallbackTimeoutsTotal.inc()
);
externalCryptoService.metricsEventEmitter.on(
  'callbackTime',
  (url, code, timeUsedInMs) =>
    externalCryptoCallbackDurationMilliseconds
      .labels(url, code)
      .observe(timeUsedInMs)
);
tendermint.metricsEventEmitter.on(
  'processingBlocksCount',
  (processingBlocksCount) => processingBlocksTotal.set(processingBlocksCount)
);
common.metricsEventEmitter.on('blockProcessFail', (fromHeight, toHeight) =>
  blockProcessFailsTotal.inc(toHeight - fromHeight + 1)
);
common.metricsEventEmitter.on('blockProcessTime', (timeUsedInMs) =>
  blockProcessDurationMilliseconds.observe(timeUsedInMs)
);
common.metricsEventEmitter.on(
  'processingInboundMessagesCount',
  (processingInboundMessagesCount) =>
    processingInboundMqMessages.set(processingInboundMessagesCount)
);
common.metricsEventEmitter.on('inboundMessageProcessFail', () =>
  inboundMqMessageProcessFailsTotal.inc()
);
common.metricsEventEmitter.on(
  'inboundMessageProcessTime',
  (type, timeUsedInMs) =>
    inboundMqMessageProcessDurationMilliseconds
      .labels(type)
      .observe(timeUsedInMs)
);

export function stopCollectDefaultMetrics() {
  clearInterval(defaultMetricsInterval);
}
