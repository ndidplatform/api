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

import logger from '../logger';

import { tendermintAddress } from '../config';

const PING_INTERVAL = 30000;

export default class TendermintWsClient extends EventEmitter {
  constructor() {
    super();
    this.wsConnected = false;
    this.isAlive = false;
    this.reconnect = true;
    this.rpcId = 0;
    this.queue = [];
    this.connect();
  }

  connect() {
    logger.info({
      message: 'Tendermint WS connecting',
    });
    this.ws = new WebSocket(`ws://${tendermintAddress}/websocket`);
    this.ws.on('open', () => {
      logger.info({
        message: 'Tendermint WS connected',
      });

      this.wsConnected = true;
      this.isAlive = true;

      this.emit('connected');

      this.pingIntervalFn = setInterval(() => {
        if (this.isAlive === false) return this.ws.terminate();

        this.isAlive = false;
        this.ws.ping();
      }, PING_INTERVAL);

      this.subscribeToNewBlockHeaderEvent();
    });

    this.ws.on('close', (code, reason) => {
      if (this.wsConnected === true) {
        logger.info({
          message: 'Tendermint WS disconnected',
          code,
          reason,
        });

        this.emit('disconnected');
      }

      this.wsConnected = false;
      this.isAlive = false;
      clearInterval(this.pingIntervalFn);
      this.pingIntervalFn = null;

      if (this.reconnect) {
        // Try reconnect
        setTimeout(() => this.connect(), 1000);
      }
    });

    this.ws.on('error', (error) => {
      logger.error({
        message: 'Tendermint WS error',
        error,
      });
      // this.emit('error', error);
    });

    this.ws.on('message', (message) => {
      // logger.debug({
      //   message: 'Data received from tendermint WS',
      //   data: message,
      // });
      try {
        message = JSON.parse(message);
      } catch (error) {
        logger.warn({
          message: 'Error JSON parsing message received from tendermint',
          data: message,
          error,
        });
        return;
      }

      const rpcId = parseInt(message.id);
      if (this.queue[rpcId]) {
        if (message.error) {
          this.queue[rpcId].promise[1]({
            type: 'JSON-RPC ERROR',
            error: message.error,
          });
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
  getStatus() {
    return this._call('status', []);
  }

  /**
   *
   * @param {number} height Block height to query
   * @returns {Promise<Object>}
   */
  getBlock(height) {
    return this._call('block', [height]);
  }

  /**
   *
   * @param {number} fromHeight
   * @param {number} toHeight
   * @returns {Promise<Object[]>}
   */
  async getBlocks(fromHeight, toHeight) {
    const heights = Array.from(
      { length: toHeight - fromHeight + 1 },
      (v, i) => i + fromHeight
    );
    const blocks = await Promise.all(
      heights.map((height) => this.getBlock(height))
    );
    return blocks;
  }

  // NOT WORKING - Can't figure out params format. No docs on tendermint.
  // abciQuery(data) {
  //   return this._call('abci_query', [
  //     '',
  //     Buffer.from(data).toString('base64'),
  //     '',
  //     '',
  //   ]);
  // }

  // broadcastTxCommit(tx) {
  //   return this._call('broadcast_tx_commit', [
  //     Buffer.from(tx).toString('base64'),
  //   ]);
  // }

  // broadcastTxSync(tx) {
  //   return this._call('broadcast_tx_sync', [
  //     Buffer.from(tx).toString('base64'),
  //   ]);
  // }

  subscribeToNewBlockHeaderEvent() {
    if (this.wsConnected) {
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

  close() {
    if (!this.ws) return;
    this.reconnect = false;
    this.ws.close();
  }

  _call(method, params, wsOpts) {
    return new Promise((resolve, reject) => {
      if (!this.wsConnected) {
        return reject(new Error('socket is not connected'));
      }

      const id = ++this.rpcId;
      const message = {
        jsonrpc: '2.0',
        method: method,
        params: params || null,
        id: id.toString(),
      };

      this.ws.send(JSON.stringify(message), wsOpts, (error) => {
        if (error) {
          return reject(error);
        }

        this.queue[id] = { promise: [resolve, reject] };
      });
    });
  }
}
