var MQRecv = require('../mq/mqrecv.js');
var EventEmitter = require('events').EventEmitter;
var zmq = require('zeromq');
var util = require ('util');

var MQRecv = function(config) {

  this.receivingSocket = zmq.socket('rep');
  this.receivingSocket.setsockopt(zmq.ZMQ_MAXMSGSIZE, config.maxMsgSize || -1);  // maximum receiver size ( -1 receive all )
  this.receivingSocket.setsockopt(zmq.ZMQ_IDENTITY, null); // no socket identity ( every time the app restart, we don't resume)

  this.receivingSocket.bindSync('tcp://*:' + config.port);

  this.receivingSocket.on('message', async function(jsonMessageStr) {
      const jsonMessage = JSON.parse(jsonMessageStr);

      this.receivingSocket.send(JSON.stringify({seq:jsonMessage.seq, msgId:jsonMessage.msgId}));

      this.emit('message', jsonMessage.msg);
  }.bind(this));
};

util.inherits(MQRecv, EventEmitter);

module.exports = MQRecv;
