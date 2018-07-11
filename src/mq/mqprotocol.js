
let MQProtocol = function() {

};


MQProtocol.prototype._applyRetrySpec = function ( message, retryspec ) {
  let ret = JSON.stringify ({msgId:retryspec.msgId, seqId:retryspec.seqId, message:message});
  return ret;
}

MQProtocol.prototype._extractRetrySpec = function ( message ) {
    const jsonMsg = JSON.parse(message);
    return { retryspec:{msgId: jsonMsg.msgId, seqId: jsonMsg.seqId}, message: jsonMsg.message }
}

MQProtocol.prototype.GenerateSendMsg = function (payload, retryspec) {
    let msg = payload;
    msg = this._applyRetrySpec (msg,retryspec);
    return msg;
}

MQProtocol.prototype.ExtractMsg = function (payload, retryspec) {
    let msg = payload;
    return this._extractRetrySpec (msg);
}

MQProtocol.prototype.GenerateAckMsg = function (retryspec) {
    let ack = "";
    ack = this._applyRetrySpec (ack, retryspec);
    
    return ack;
}

module.exports = MQProtocol;
