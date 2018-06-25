let EventEmitter = require('events').EventEmitter;
let zmq = require('zeromq');
let util = require ('util');

let MQRecvSocket = function(config) {

  this.receivingSocket = zmq.socket('rep');
  this.receivingSocket.setsockopt(zmq.ZMQ_MAXMSGSIZE, config.maxMsgSize || -1);  // maximum receiver size ( -1 receive all )
  this.receivingSocket.setsockopt(zmq.ZMQ_LINGER, 0);  // no lingering time after socket close. we want to control send by business logic
  //  this.receivingSocket.setsockopt(zmq.ZMQ_IDENTITY,{}) ; // no socket identity ( every time the app restart, we don't resume)

  this.receivingSocket.bindSync('tcp://*:' + config.port);

  this.receivingSocket.on('message', function(jsonMessageStr) {
     this.emit('message', jsonMessageStr);
  }.bind(this));

  this.receivingSocket.on('error', function(error) {
      this.emit('error', error);
  }.bind(this));

};

MQRecvSocket.prototype.send = function(payload){
  this.receivingSocket.send(payload);
}

util.inherits(MQRecvSocket, EventEmitter);

module.exports = MQRecvSocket;
