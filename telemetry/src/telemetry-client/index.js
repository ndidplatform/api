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
import GRPCTelemetryClient from './grpc';
import logger from '../logger';

export default class TelemetryClient {
  constructor({ tokenManager }) {
    /**
     * @type {import('../token').default}
     */
    this.tokenManager = tokenManager;

    // create new GRPCTelemetryClient
    this.client = new GRPCTelemetryClient();
  }

  async receiveMainVersionLogData(nodeId, logs) {
    if (!logs || logs.length === 0) return; // no events

    const token = await this.tokenManager.getTokenFromNodeId(nodeId);
    if (token == null) {
      // no token for this nodeId
      // cannot send the data
      logger.warn(`No auth token of node ID: "${nodeId}"; Unable to send`);
      this.tokenManager.requestNewToken(nodeId);
      return false;
    }

    try {
      logger.info('Sending', logs.length, 'main version logs of', nodeId);
      const result = await this.client.sendMainVersionLogs({
        nodeId,
        token,
        logs,
      });

      // incase the operation is invalid, remove the token manager and try the operation again
      if (this.client.isTokenInvalid(result)) {
        logger.info('Invalidating token of node', nodeId, token);
        await this.tokenManager.invalidateToken(nodeId, token);
        return this.receiveMainVersionLogData(nodeId, logs);
      }

      return this.client.isOk(result);
    } catch (error) {
      logger.error({
        message: 'Error sending main version logs',
        err: error,
      });
      return false;
    }
  }

  async receiveMQServiceVersionLogData(nodeId, logs) {
    if (!logs || logs.length === 0) return; // no events

    const token = await this.tokenManager.getTokenFromNodeId(nodeId);
    if (token == null) {
      // no token for this nodeId
      // cannot send the data
      logger.warn(`No auth token of node ID: "${nodeId}"; Unable to send`);
      this.tokenManager.requestNewToken(nodeId);
      return false;
    }

    try {
      logger.info('Sending', logs.length, 'MQ service version logs of', nodeId);
      const result = await this.client.sendMQServiceVersionLogs({
        nodeId,
        token,
        logs,
      });

      // incase the operation is invalid, remove the token manager and try the operation again
      if (this.client.isTokenInvalid(result)) {
        logger.info('Invalidating token of node', nodeId, token);
        await this.tokenManager.invalidateToken(nodeId, token);
        return this.receiveMainVersionLogData(nodeId, logs);
      }

      return this.client.isOk(result);
    } catch (error) {
      logger.error({
        message: 'Error sending MQ service version logs',
        err: error,
      });
      return false;
    }
  }

  async receiveTendermintAndABCIVersionLogData(nodeId, logs) {
    if (!logs || logs.length === 0) return; // no events

    const token = await this.tokenManager.getTokenFromNodeId(nodeId);
    if (token == null) {
      // no token for this nodeId
      // cannot send the data
      logger.warn(`No auth token of node ID: "${nodeId}"; Unable to send`);
      this.tokenManager.requestNewToken(nodeId);
      return false;
    }

    try {
      logger.info(
        'Sending',
        logs.length,
        'Tendermint and ABCI version logs of',
        nodeId
      );
      const result = await this.client.sendTendermintAndABCIVersionLogs({
        nodeId,
        token,
        logs,
      });

      // incase the operation is invalid, remove the token manager and try the operation again
      if (this.client.isTokenInvalid(result)) {
        logger.info('Invalidating token of node', nodeId, token);
        await this.tokenManager.invalidateToken(nodeId, token);
        return this.receiveMainVersionLogData(nodeId, logs);
      }

      return this.client.isOk(result);
    } catch (error) {
      logger.error({
        message: 'Error sending Tendermint and ABCI version logs',
        err: error,
      });
      return false;
    }
  }

  async receiveRequestEventData(nodeId, events) {
    if (!events || events.length === 0) return; // no events

    const token = await this.tokenManager.getTokenFromNodeId(nodeId);
    if (token == null) {
      // no token for this nodeId
      // cannot send the data
      logger.warn(`No auth token of node ID: "${nodeId}"; Unable to send`);
      this.tokenManager.requestNewToken(nodeId);
      return false;
    }

    try {
      logger.info('Sending', events.length, 'request events of', nodeId);
      const result = await this.client.sendRequestEvents({
        nodeId,
        token,
        events,
      });

      // incase the operation is invalid, remove the token manager and try the operation again
      if (this.client.isTokenInvalid(result)) {
        logger.info('Invalidating token of node', nodeId, token);
        await this.tokenManager.invalidateToken(nodeId, token);
        return this.receiveRequestEventData(nodeId, events);
      }

      return this.client.isOk(result);
    } catch (error) {
      logger.error({
        message: 'Error sending request events',
        err: error,
      });
      return false;
    }
  }
}
