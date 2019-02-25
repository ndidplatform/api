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
import errorType from 'ndid-error/type';

// const PING_INTERVAL = 30000;
const PING_TIMEOUT_MS = 60000;

export default class TendermintWsClient extends EventEmitter {
  constructor(name = '', connect) {
    super();
    this.name = name;
    this.connected = false;
    // this.isAlive = false;
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
      connectionName: this.name,
    });
    this.ws = new WebSocket(`ws://${tendermintAddress}/websocket`);
    this.ws.on('open', () => {
      logger.info({
        message: 'Tendermint WS connected',
        connectionName: this.name,
      });
      // Reset backoff interval
      this.backoff.reset();
      this.reconnectTimeoutFn = null;

      this.connected = true;
      // this.isAlive = true;

      this.emit('connected');

      // this.pingIntervalFn = setInterval(() => {
      //   if (this.isAlive === false) return this.ws.terminate();

      //   this.isAlive = false;
      //   this.ws.ping();
      // }, PING_INTERVAL);

      this.pingTimeoutFn = setTimeout(() => {
        this.pingTimeout();
      }, PING_TIMEOUT_MS);
    });

    this.ws.on('close', (code, reason) => {
      if (this.connected === true) {
        logger.info({
          message: 'Tendermint WS disconnected',
          connectionName: this.name,
          code,
          reason,
        });

        // Reject all `_call` promises
        for (let rpcId in this.queue) {
          const error = new CustomError({
            message: 'Connection closed',
            details: {
              rpcId,
            },
          });
          this.queue[rpcId].promise[1](error);
          delete this.queue[rpcId];
        }

        this.emit('disconnected');
      }

      this.connected = false;
      // this.isAlive = false;
      // clearInterval(this.pingIntervalFn);
      // this.pingIntervalFn = null;
      clearTimeout(this.pingTimeoutFn);
      this.pingTimeoutFn = null;

      if (this.reconnect) {
        // Try reconnect
        const backoffTime = this.backoff.next();
        logger.debug({
          message: `Tendermint WS try reconnect in ${backoffTime} ms`,
          connectionName: this.name,
        });
        this.reconnectTimeoutFn = setTimeout(() => this.connect(), backoffTime);
      }
    });

    this.ws.on('error', (error) => {
      logger.error({
        message: 'Tendermint WS error',
        connectionName: this.name,
        err: error,
      });
      // this.emit('error', error);
    });

    this.ws.on('message', (message) => {
      // logger.debug({
      //   message: 'Data received from tendermint WS',
      //   connectionName: this.name,
      //   data: message,
      // });
      try {
        message = JSON.parse(message);
      } catch (error) {
        logger.warn({
          message: 'Error JSON parsing message received from tendermint',
          connectionName: this.name,
          data: message,
          err: error,
        });
        return;
      }

      const rpcId = parseInt(message.id);
      if (this.queue[rpcId]) {
        if (message.error) {
          let error;
          if (message.error.data === 'Mempool is full') {
            error = new CustomError({
              errorType: errorType.TENDERMINT_MEMPOOL_FULL,
              details: {
                error: message.error,
                rpcId,
              },
            });
          } else {
            error = new CustomError({
              errorType: errorType.TENDERMINT_TRANSACT_JSON_RPC_ERROR,
              details: {
                error: message.error,
                rpcId,
              },
            });
          }
          this.queue[rpcId].promise[1](error);
        } else {
          this.queue[rpcId].promise[0](message.result);
        }

        delete this.queue[rpcId];
        return;
      }

      this.emit(message.id, message.error, message.result);
    });

    // this.ws.on('pong', () => {
    //   this.isAlive = true;
    // });

    this.ws.on('ping', () => {
      // console.log('>>>RECEIVED PING<<<', Date.now())
      clearTimeout(this.pingTimeoutFn);
      this.pingTimeoutFn = setTimeout(() => {
        this.pingTimeout();
      }, PING_TIMEOUT_MS);
    });
  }

  pingTimeout() {
    logger.debug({
      message:
        'Tendermint WS ping timed out (did not receive ping from server). Terminating connection.',
      connectionName: this.name,
    });
    this.ws.terminate();
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
        connectionName: this.name,
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
