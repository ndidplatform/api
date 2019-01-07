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

import EventEmitter from 'events';

import WebSocket from 'ws';
import { ExponentialBackoff } from 'simple-backoff';

import logger from '../logger';

import { tendermintAddress } from '../config';
import CustomError from 'ndid-error/custom_error';

const PING_INTERVAL = 30000;

export default class TendermintWsClient extends EventEmitter {
  constructor(name = '', connect) {
    super();
    this.name = name;
    this.connected = false;
    this.isAlive = false;
    this.reconnect = true;
    this.rpcId = 0;
    this.queue = [];
    this.backoff = new ExponentialBackoff({
      min: 1000,
      max: 15000,
      factor: 2,
      jitter: 0,
    });
    if (connect) {
      this.connect();
    }
  }

  connect() {
    logger.info({
      message: 'Tendermint WS connecting',
      name: this.name,
    });
    this.ws = new WebSocket(`ws://${tendermintAddress}/websocket`);
    this.ws.on('open', () => {
      logger.info({
        message: 'Tendermint WS connected',
        name: this.name,
      });
      // Reset backoff interval
      this.backoff.reset();
      this.reconnectTimeoutFn = null;

      this.connected = true;
      this.isAlive = true;

      this.emit('connected');

      this.pingIntervalFn = setInterval(() => {
        if (this.isAlive === false) return this.ws.terminate();

        this.isAlive = false;
        this.ws.ping();
      }, PING_INTERVAL);
    });

    this.ws.on('close', (code, reason) => {
      if (this.connected === true) {
        logger.info({
          message: 'Tendermint WS disconnected',
          name: this.name,
          code,
          reason,
        });

        // TODO: Reject all `_call` promises here?

        this.emit('disconnected');
      }

      this.connected = false;
      this.isAlive = false;
      clearInterval(this.pingIntervalFn);
      this.pingIntervalFn = null;

      if (this.reconnect) {
        // Try reconnect
        const backoffTime = this.backoff.next();
        logger.debug({
          message: `Tendermint WS try reconnect in ${backoffTime} ms`,
          name: this.name,
        });
        this.reconnectTimeoutFn = setTimeout(() => this.connect(), backoffTime);
      }
    });

    this.ws.on('error', (error) => {
      logger.error({
        message: 'Tendermint WS error',
        name: this.name,
        error,
      });
      // this.emit('error', error);
    });

    this.ws.on('message', (message) => {
      // logger.debug({
      //   message: 'Data received from tendermint WS',
      //   name: this.name,
      //   data: message,
      // });
      try {
        message = JSON.parse(message);
      } catch (error) {
        logger.warn({
          message: 'Error JSON parsing message received from tendermint',
          name: this.name,
          data: message,
          error,
        });
        return;
      }

      const rpcId = parseInt(message.id);
      if (this.queue[rpcId]) {
        if (message.error) {
          const error = new CustomError({
            message: 'JSON-RPC ERROR',
            details: {
              error: message.error,
              rpcId,
            },
          });
          this.queue[rpcId].promise[1](error);
        } else {
          this.queue[rpcId].promise[0](message.result);
        }

        delete this.queue[rpcId];
        return;
      }

      this.emit(message.id, message.error, message.result);
    });

    this.ws.on('pong', () => {
      this.isAlive = true;
    });
  }

  /**
   *
   * @returns {Promise<Object>}
   */
  status() {
    return this._call('status', []);
  }

  /**
   *
   * @param {number} height Block height to query
   * @returns {Promise<Object>}
   */
  block(height) {
    return this._call('block', [`${height}`]);
  }

  blockResults(height) {
    return this._call('block_results', [`${height}`]);
  }

  tx(hash, prove) {
    return this._call('tx', { hash: hash.toString('base64'), prove });
  }

  abciQuery(data, height) {
    const params = {
      data: data.toString('hex'),
    };
    if (height) {
      params.height = `${height}`;
    }
    return this._call('abci_query', params);
  }

  broadcastTxCommit(tx) {
    return this._call('broadcast_tx_commit', { tx: tx.toString('base64') });
  }

  broadcastTxSync(tx) {
    return this._call('broadcast_tx_sync', { tx: tx.toString('base64') });
  }

  subscribeToNewBlockHeaderEvent() {
    if (this.connected) {
      this.ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'subscribe',
          params: ["tm.event = 'NewBlockHeader'"],
          id: 'newBlockHeader',
        })
      );
    }
  }

  subscribeToNewBlockEvent() {
    if (this.connected) {
      this.ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'subscribe',
          params: ["tm.event = 'NewBlock'"],
          id: 'newBlock',
        })
      );
    }
  }

  subscribeToTxEvent() {
    if (this.connected) {
      this.ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'subscribe',
          params: ["tm.event = 'Tx'"],
          id: 'tx',
        })
      );
    }
  }

  close() {
    if (!this.ws) return;
    this.reconnect = false;
    clearTimeout(this.reconnectTimeoutFn);
    this.reconnectTimeoutFn = null;
    this.ws.close();
  }

  _call(method, params, wsOpts) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('socket is not connected'));
      }

      const id = ++this.rpcId;
      const message = {
        jsonrpc: '2.0',
        method: method,
        params: params || null,
        id: id.toString(),
      };

      logger.debug({
        message: 'Calling Tendermint through WS',
        name: this.name,
        payload: message,
      });
      this.ws.send(JSON.stringify(message), wsOpts, (error) => {
        if (error) {
          return reject(
            new CustomError({
              message: 'Tendermint WS send error',
              details: {
                error,
                rpcId: id,
              },
            })
          );
        }

        this.queue[id] = { promise: [resolve, reject] };
      });
    });
  }
}
