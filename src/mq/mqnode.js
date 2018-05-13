var EventEmitter = require('events').EventEmitter;
import zmq from 'zeromq';
import * as utils from '../utils';
import util from 'util';

var MQNode = function(config) {
  
  var self = this;
  this.retryCount = 0;
  this.maxRetries = config.totalTimeout || 10000 / config.timeout || 2500;
  this.timeout = config.timeout || 2500;
  this.timerId = -1;

  const receivingSocket = zmq.socket('rep');
  
  receivingSocket.bindSync('tcp://*:' + config.port);
   
  receivingSocket.on('message', async function(message) {
  
     self.emit('message', message);
  });
};

util.inherits(MQNode, EventEmitter);


/*
MQNode.prototype._handleMessage = function (msg) {
  this.awaitingReply = false;
  clearTimeout(this.timerId);
  this.timerId = -1;
  this.retryCount = 0;
};

MQNode.prototype._initSocket = function () {
  this.socket = zmq.socket('req');
  this.socket.identity = this.identity;
  this.socket.connect(this.url);
  this.awaitingReply = false;
};

MQNode.prototype._initHandler = function () {
  this.socket.on('message', this._handleMessage.bind(this));
};

MQNode.prototype._retry = function () {
  if (++this.retryCount > this.maxRetries) {
    this.emit('send_error', new Error('No reply after ' + this.maxRetries + ' retries. Giving up.'));
  }
  else {
    this.socket.close();
    this._initSocket();
    this._initHandler();
    this.ready();
  }
};

*/
MQNode.prototype.send = function (receiver, message) {
    const sendingSocket = zmq.socket('req');
    
  
    sendingSocket.connect(`tcp://${receiver.ip}:${receiver.port}`);

 
    sendingSocket.send(message);

    // TO BE REVISED
    // When should we disconnect the socket?
    // If the socket is disconnected, all the messages in queue will be lost.
    // Hence, the receiver may not get the messages.
    sendingSocket.disconnect(`tcp://${receiver.ip}:${receiver.port}`);
};



module.exports = MQNode;
