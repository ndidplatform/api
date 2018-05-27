var zmq = require( 'zeromq');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var MQSend = function(config) {
  
  var self = this;
  const totalTimeout = config.totalTimeout || 30000
  this.timeout = config.timeout || 10000; 
  this.maxRetries = totalTimeout / this.timeout
  this.timerId = -1;
  this.waitQueue = new Set();
  this.sequence = 0;
  
};

util.inherits(MQSend, EventEmitter);


MQSend.prototype._init = function (receiver) {
  const sendingSocket = zmq.socket('req');
  const dest = `tcp://${receiver.ip}:${receiver.port}`;

  sendingSocket.connect(dest);

  return sendingSocket;
}

MQSend.prototype._send = function (sendingSocket, receiver, message, retryCount=0) {


  this.sequence++;
  const seq = this.sequence;

  sendingSocket.on('message', async function(jsonMessageStr) {
    const jsonMessage = JSON.parse(jsonMessageStr);
    this.emit('state', 'Received ACK for ' + jsonMessage.seq );
    clearTimeout(this.timerId);
    this.waitQueue.delete(seq); 
    sendingSocket.close();
  }.bind(this));

  this.waitQueue.add(seq);
  
  this.emit('state', 'Sending message ' + seq );
  sendingSocket.send(JSON.stringify({seq:seq,msg:message}));
  this.emit('state', 'Finish Sending message ' + seq );
  
  this.timerId = setTimeout(this._retry.bind(this), this.timeout,
                 receiver, message, seq, ++retryCount, sendingSocket);

}

MQSend.prototype._retry = function ( receiver, msg, seq, retryCount, sendingSocket) {
  
  if (this.waitQueue.has(seq))
  {

   
    if (retryCount > this.maxRetries) {
      this.emit('state', 'Max retry reached');
      this.emit('error', new Error('No reply after ' + this.maxRetries + ' retries. Giving up.'));
      this.waitQueue.delete(seq);
      this.emit('state', 'Closing socket');
      sendingSocket.close();
   
    }
    else {
      this.emit('state', 'Timeout for message ' + seq + ', retry #' + retryCount);
      this.emit('state', 'Craete new socket');
      var newSocket = this._init(receiver);
      this._send(newSocket, receiver, msg, retryCount);
    }
  }
};



MQSend.prototype.send = function (receiver, message, retryCount=0) {
    var socket = this._init(receiver);
    this._send(socket, receiver, message, retryCount=0);
}

/*
MQSend.prototype.send = function (receiver, message, retryCount=0) {
   
    const sendingSocket = zmq.socket('req');
    const dest = `tcp://${receiver.ip}:${receiver.port}`;
    this.sequence++;
    const seq = this.sequence;

    sendingSocket.on('message', async function(jsonMessageStr) {
      const jsonMessage = JSON.parse(jsonMessageStr);
      this.emit('state', 'Received ACK for ' + jsonMessage.seq );
      clearTimeout(this.timerId);
      this.waitQueue.delete(seq); 
      sendingSocket.close();
    }.bind(this));

    this.waitQueue.add(seq);

    sendingSocket.connect(dest);

    this.emit('state', 'Sending message ' + seq );
    sendingSocket.send(JSON.stringify({seq:seq,msg:message}));
    this.emit('state', 'Finish Sending message ' + seq );
    
    this.timerId = setTimeout(this._retry.bind(this), this.timeout,
                  receiver, message, seq, ++retryCount, sendingSocket);

  };
*/
module.exports = MQSend;
