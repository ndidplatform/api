
let util = require('util');
let EventEmitter = require('events').EventEmitter;


let MQLogic = function(config) {
  const totalTimeout = config.totalTimeout || 120000;
  this.timeout = config.timeout || 30000;
  this.maxRetries = totalTimeout / this.timeout;
  this.maxSeqId = 0;
  this.maxMsgId = 0;
  this.seqMap = new Map();
};

MQLogic.prototype._cleanUp = function(msgId){

  let itemToDelete = [];
  for (var [key, value] of this.seqMap) {
    if(value.msgId==msgId) {
      clearTimeout(value.timerId)
      this.emit('PerformCleanUp', value.seqId );
      itemToDelete.push(key);
    }
  }

  for (let i = 0; i < itemToDelete.length; i++)
  {
    this.seqMap.delete(itemToDelete[i]);
  }
}

MQLogic.prototype._performSend = function (dest, payload, msgId, retryCount=0) {
  this.maxSeqId++;
  const seqId = this.maxSeqId;

  let timerId = setTimeout(this._retry.bind(this), this.timeout,
                 dest, payload, msgId, seqId, ++retryCount);
  this.seqMap.set(seqId, { seqId:seqId, msgId:msgId, timerId:timerId });

  this.emit('PerformSend', {dest:dest, payload:payload, msgId:msgId, seqId:seqId} );
}

MQLogic.prototype.AckReceived = function ( msgId ){
    this._cleanUp(msgId);
}

MQLogic.prototype._retry = function ( dest, payload, msgId, seqId, retryCount ) {
  if (this.seqMap.has(seqId)) {
    if (retryCount >= this.maxRetries) {
      this._cleanUp(msgId);
      this.emit('PerformTotalTimeout', {msgId:msgId});
    }
    else {
      this._performSend( dest, payload, msgId, retryCount );
    }
  }
};

MQLogic.prototype.Send = function (dest, payload) {
   this.maxMsgId++;
   this._performSend(dest, payload, this.maxMsgId);
}

util.inherits(MQLogic, EventEmitter);
module.exports = MQLogic;
