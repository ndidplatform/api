let util = require('util');
let EventEmitter = require('events').EventEmitter;
import MQProtocol from './mqprotocol.js';
import MQLogic    from './mqlogic.js';
import MQSendSocket from './mqsendsocket.js'
import CustomError from '../error/customError';

let protocol = new MQProtocol();




let MQSend = function(config) {
  this.totalTimeout = config.totalTimeout || 120000;
  this.timeout = config.timeout || 30000;
  this.id = config.id || "";

  this.logic = new MQLogic({totalTimeout:this.totalTimeout, timeout:this.timeout});

  this.logic.on('PerformSend', function (params) {
      let message = protocol.GenerateSendMsg(params.payload, {msgId:params.msgId, seqId:params.seqId});
      this.emit('debug', this.id + ': sending msg' + params.msgId);

      this.socket.send(params.dest, message, params.seqId);
  }.bind(this));

  this.logic.on('PerformCleanUp',function (seqId) {
      this._cleanUp(seqId);
  }.bind(this));

  this.logic.on('PerformTotalTimeout', function (msgId) {
      this.emit('error', new CustomError({code:'MQERR_TIMEOUT', message: this.id + ': Too many retries. Giving up.'}));
  }.bind(this));

  this.socket = new MQSendSocket();

  this.socket.on('error', function(err) {
      this.emit('error', err);
  }.bind(this));

  this.socket.on('message', function(jsonMessageStr) {
    const msg = protocol.ExtractMsg(jsonMessageStr);
    this.emit('debug', 'Received ACK for ' + msg.retryspec.msgId + '/' + msg.retryspec.seqId );
    this.logic.AckReceived(msg.retryspec.msgId);
  }.bind(this));
};

MQSend.prototype._cleanUp = function(seqId){
  try {
      this.socket.cleanUp(seqId);
  } catch (error) {
      this.emit('error', new CustomError({code:'MQERR_CLEANUPERR', message:error}));
  }
}

MQSend.prototype.send = function (dest, payload ) {
    // let the logic to dictate when\where it should send
    this.logic.Send(dest, payload);
}

util.inherits(MQSend, EventEmitter);

module.exports = MQSend;
