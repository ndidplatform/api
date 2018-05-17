import EventEmitter from 'events';
import WebSocket from 'ws';

import { TENDERMINT_ADDRESS } from '../config';

export default class TendermintWsClient extends EventEmitter {
  constructor() {
    super();
    this.wsConnected = false;
    this.rpcId = 0;
    this.queue = [];
    this.connect();
  }

  connect() {
    this.reconnect = true;

    this.ws = new WebSocket(`ws://${TENDERMINT_ADDRESS}/websocket`);
    this.ws.on('open', () => {
      console.log('Tendermint WS connected');
      this.wsConnected = true;

      this.emit('connected');

      this.subscribeToNewBlockHeaderEvent();
    });

    this.ws.on('close', () => {
      console.log('Tendermint WS disconnected');
      this.wsConnected = false;

      this.emit('disconnected');

      if (this.reconnect) {
        // Try reconnect
        setTimeout(() => this.connect(), 1000);
      }
    });

    this.ws.on('error', (error) => {
      console.log('Tendermint WS error:', error);
      // this.emit('error', error);
    });

    this.ws.on('message', (message) => {
      // console.log('>>>', message);
      try {
        message = JSON.parse(message);
      } catch (error) {
        console.warn('Error JSON parsing data received from tendermint');
        return;
      }

      const rpcId = parseInt(message.id);
      if (this.queue[rpcId]) {
        if (message.error) {
          this.queue[rpcId].promise[1](message.error);
        } else {
          this.queue[rpcId].promise[0](message.result);
        }

        delete this.queue[rpcId];
        return;
      }

      this.emit(message.id, message.error, message.result);
    });

    // tendermint websocket sends 'ping' periodically
    // this.ws.on('ping', () => {
    //   console.warn('ping received')
    // });
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
