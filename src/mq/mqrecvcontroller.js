let EventEmitter = require('events').EventEmitter;
let util = require ('util');
import MQProtocol from './mqprotocol.js';
import CustomError from '../error/customError';
import MQRecvSocket from './mqrecvsocket.js'

let protocol = new MQProtocol();

let MQRecv = function(config) {
  this.recvSocket  = new MQRecvSocket({maxMsgSize:config.maxMsgSize, port:config.port})

  this.recvSocket.on('message',  function(jsonMessageStr) {
    
      const jsonMessage = protocol.ExtractMsg(jsonMessageStr);
      const ackMSG = protocol.GenerateAckMsg({msgId:jsonMessage.retryspec.msgId, seqId:jsonMessage.retryspec.seqId});

      this.recvSocket.send(ackMSG);
      this.emit('message', jsonMessage.message);
  }.bind(this));

  this.recvSocket.on('error',  function(error) {
      this.emit('error', error);
  }.bind(this));
};

util.inherits(MQRecv, EventEmitter);

module.exports = MQRecv;
