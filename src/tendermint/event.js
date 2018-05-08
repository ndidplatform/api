import EventEmitter from 'events';
import WebSocket from 'ws';

import { TENDERMINT_ADDRESS } from '../config';

export default class TendermintEvent extends EventEmitter {
  constructor() {
    super();
    this.wsConnected = false;
    this.connectWs();
  }

  connectWs() {
    this.ws = new WebSocket(`ws://${TENDERMINT_ADDRESS}/websocket`);
    this.ws.on('open', () => {
      console.log('Tendermint WS connected');
      this.wsConnected = true;

      this.subscribeToNewBlockEvent();
    });

    this.ws.on('close', () => {
      console.log('Tendermint WS disconnected');
      this.wsConnected = false;
      // Try reconnect
      setTimeout(() => this.connectWs(), 1000);
    });

    this.ws.on('error', (error) => {
      console.log('Tendermint WS error:', error);
      // this.emit('error', error);
    });

    this.ws.on('message', (data) => {
      // console.log('>>>', data);
      try {
        const jsonData = JSON.parse(data);
        this.emit(jsonData.id, jsonData.error, jsonData.result);
      } catch (error) {
        console.warn('Error JSON parsing data received from tendermint')
      }
    });

    // tendermint websocket sends 'ping' periodically
    // this.ws.on('ping', () => {
    //   console.warn('ping received')
    // });
  }

  subscribeToNewBlockEvent() {
    if (this.wsConnected) {
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

  closeWs() {
    if (!this.ws) return;
    this.ws.close();
  }
}
