var MQRecv = require('../mq/mqrecv.js');
var EventEmitter = require('events').EventEmitter;
var zmq = require('zeromq');
//import zmq from 'zeromq';
//import * as utils from '../main/utils';

var util = require ('util');
//import util from 'util';

var MQRecv = function(config) {
  
  this.receivingSocket = zmq.socket('rep');
  
  this.receivingSocket.bindSync('tcp://*:' + config.port);
   
  this.receivingSocket.on('message', async function(jsonMessageStr) {
      const jsonMessage = JSON.parse(jsonMessageStr);

      this.receivingSocket.send(JSON.stringify({seq:jsonMessage.seq, msgId:jsonMessage.msgId}));

      if (jsonMessage.msg.length < 100000)
        console.log("receive message:"+ jsonMessage.seq +  ": " + jsonMessage.msg);
      this.emit('message', jsonMessage.msg);    
  }.bind(this));
};

util.inherits(MQRecv, EventEmitter);

module.exports = MQRecv;
