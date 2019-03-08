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

import * as prometheusHttpServer from './http_server';

import { metricsEventEmitter } from '../server';

const PREFIX = 'mq';

let defaultMetricsInterval;

export function initialize() {
  defaultMetricsInterval = Prometheus.collectDefaultMetrics({
    prefix: `${PREFIX}_`,
  });

  const sendingSocketConnectionsTotal = new Prometheus.Gauge({
    name: `${PREFIX}_sending_socket_connections_total`,
    help: 'Number of opened sending socket connections',
  });

  const incomingMessageSubscribersTotal = new Prometheus.Gauge({
    name: `${PREFIX}_incoming_message_subscribers_total`,
    help: 'Number of incoming message subscribers',
  });

  const incomingMessagesTotal = new Prometheus.Counter({
    name: `${PREFIX}_incoming_messages_total`,
    help: 'Total number of incoming messages',
  });

  const incomingMessageSentACKsTotal = new Prometheus.Counter({
    name: `${PREFIX}_incoming_message_sent_acks_total`,
    help: 'Total number of incoming message sent ACKs',
  });

  const incomingMessagesWithoutSubscriberTotal = new Prometheus.Counter({
    name: `${PREFIX}_incoming_messages_without_subscriber_total`,
    help:
      'Total number of incoming messages without subscriber to forward message to',
  });

  const incomingMessageErrorsTotal = new Prometheus.Counter({
    name: `${PREFIX}_incoming_message_errors_total`,
    help: 'Total number of incoming message errors',
  });

  const outgoingMessagesTotal = new Prometheus.Counter({
    name: `${PREFIX}_outgoing_messages_total`,
    help: 'Total number of outgoing messages',
  });

  const outgoingMessageReceivedACKsTotal = new Prometheus.Counter({
    name: `${PREFIX}_outgoing_message_received_acks_total`,
    help: 'Total number of outgoing message received ACKs',
  });

  const outgoingMessageRetriesTotal = new Prometheus.Counter({
    name: `${PREFIX}_outgoing_message_retries_total`,
    help: 'Total number of outgoing message retries',
  });

  const outgoingMessageSendTimeoutsTotal = new Prometheus.Counter({
    name: `${PREFIX}_outgoing_message_send_timeouts_total`,
    help: 'Total number of outgoing message send timeouts',
  });

  const outgoingMessageErrorsTotal = new Prometheus.Counter({
    name: `${PREFIX}_outgoing_message_errors_total`,
    help: 'Total number of outgoing message errors',
  });

  metricsEventEmitter.on('sending_socket_connection_count', (count) =>
    sendingSocketConnectionsTotal.set(count)
  );
  metricsEventEmitter.on('incoming_message_subscribe', () =>
    incomingMessageSubscribersTotal.inc()
  );
  metricsEventEmitter.on('incoming_message_unsubscribe', () =>
    incomingMessageSubscribersTotal.dec()
  );
  metricsEventEmitter.on('incoming_message', () => incomingMessagesTotal.inc());
  metricsEventEmitter.on('incoming_message_ack_sent', () =>
    incomingMessageSentACKsTotal.inc()
  );
  metricsEventEmitter.on('incoming_message_without_subscriber', () =>
    incomingMessagesWithoutSubscriberTotal.inc()
  );
  metricsEventEmitter.on('incoming_message_error', () =>
    incomingMessageErrorsTotal.inc()
  );
  metricsEventEmitter.on('outgoing_message', () => outgoingMessagesTotal.inc());
  metricsEventEmitter.on('outgoing_message_ack_received', () =>
    outgoingMessageReceivedACKsTotal.inc()
  );
  metricsEventEmitter.on('outgoing_message_retry', () =>
    outgoingMessageRetriesTotal.inc()
  );
  metricsEventEmitter.on('outgoing_message_send_timeout', () =>
    outgoingMessageSendTimeoutsTotal.inc()
  );
  metricsEventEmitter.on('outgoing_message_error', () =>
    outgoingMessageErrorsTotal.inc()
  );

  prometheusHttpServer.initialize();
}

function stopCollectDefaultMetrics() {
  clearInterval(defaultMetricsInterval);
}

export async function stop() {
  stopCollectDefaultMetrics();
  await prometheusHttpServer.close();
}
