var MQRecv = require('../mq/mqrecv.js');
var EventEmitter = require('events').EventEmitter;
var zmq = require('zeromq');
//import zmq from 'zeromq';
//import * as utils from '../main/utils';

var util = require ('util');
//import util from 'util';

var MQRecv = function(config) {
  
  var self = this;

  this.receivingSocket = zmq.socket('rep');
  
  this.receivingSocket.bindSync('tcp://*:' + config.port);
   
  this.receivingSocket.on('message', async function(jsonMessageStr) {
      const jsonMessage = JSON.parse(jsonMessageStr);

      self.receivingSocket.send(JSON.stringify({seq:jsonMessage.seq}));

     // console.log("receive message:"+ jsonMessage.seq +  ": " + jsonMessage.msg);
      self.emit('message', jsonMessage.msg);    
  });
};

util.inherits(MQRecv, EventEmitter);

module.exports = MQRecv;
