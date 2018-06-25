let zmq = require( 'zeromq');
let util = require('util');
let EventEmitter = require('events').EventEmitter;

let MQSendSocket = function(config) {
  this.socketMap = new Map();
};

MQSendSocket.prototype.send = function (dest, payload, seqId){
  let newSocket = this._init(dest);
  this.socketMap.set(seqId, newSocket);
  newSocket.send(payload);
}

MQSendSocket.prototype.cleanUp = function(seqId){
    this.socketMap.get(seqId).close();
    this.socketMap.delete(seqId);
}

// init socket and connection to destination ( init source socket too, which should provide limitation but is cleaner )
//
MQSendSocket.prototype._init = function (dest) {

    let sendingSocket = zmq.socket('req');
    // socket option
    sendingSocket.setsockopt(zmq.ZMQ_LINGER, 0);  // small lingering time ( 50ms ) after socket close. we want to control send by business logic
    // We are leaving that is default value but wil
    //sendingSocket.setsockopt(zmq.ZMQ_HWM, 0); // not setting means unlimited number of queueing message
    //sendingSocket.setsockopt(zmq.ZMQ_SWAP, 0); // ALL in MEMORY --
    sendingSocket.setsockopt(zmq.ZMQ_RCVTIMEO, 0 ) // no block // wait forever until close
    sendingSocket.setsockopt(zmq.ZMQ_SNDTIMEO, 0 ) // no block // wait forever until close
    sendingSocket.on('error', function(err) {
        this.emit('error', err);
    }.bind(this));

    sendingSocket.on('message', function(jsonMessageStr) {
      this.emit('message', jsonMessageStr);
    }.bind(this));

    const destUri = `tcp://${dest.ip}:${dest.port}`;
    sendingSocket.connect(destUri);
    return sendingSocket;
}


util.inherits(MQSendSocket, EventEmitter);

module.exports = MQSendSocket;
