var zmq = require( 'zeromq');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var MQSend = function(config) {
  
  var self = this;
  const totalTimeout = config.totalTimeout || 30000;
  this.timeout = config.timeout || 10000; 
  this.maxRetries = totalTimeout / this.timeout;
  this.waitQueue = new Set();
  this.sequence = 0;
  this.msgId = 0;  
  this.msgMap=[];
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
    this.emit('state', 'Received ACK for ' + jsonMessage.msgId + ':' + jsonMessage.seq );
   
    this.emit('state', 'Queue length: ' + this.msgMap.length);
    const msgId = jsonMessage.msgId;
  
     for ( let i = this.msgMap.length - 1; i >=0 ; -- i ){ 
      let element = this.msgMap[i];
         
      if(element.msgId==msgId) {
        this.emit('state', 'Clearn sibling ' + element.seq );
        this.waitQueue.delete(element.seq);
        element.socket.close();
        clearTimeout(element.timerId);
        this.msgMap.splice(i,1);
      }
    }

   
  }.bind(this));

  this.waitQueue.add(seq);
  
  let timerId = setTimeout(this._retry.bind(this), this.timeout,
                 receiver, message, seq, ++retryCount, sendingSocket);
  this.msgMap.push({seq:this.sequence, msgId:this.msgId, timerId:timerId, socket:sendingSocket});
  this.emit('state', 'Sending message ' + seq + "/" + this.msgId );
  sendingSocket.send(JSON.stringify({seq:seq, msgId:this.msgId, msg:message}));
  this.emit('state', 'Finish Sending message ' + seq );
  
  
  
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
      this._send(newSocket, receiver, msg, retryCount, sendingSocket);
    }
  }
};



MQSend.prototype.send = function (receiver, message, retryCount=0) {
   this.msgId++;

   var socket = this._init(receiver);
   this._send(socket, receiver, message, retryCount=0);
}


module.exports = MQSend;
