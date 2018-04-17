import EventEmitter from 'events';
import zmq from 'zeromq';
import * as config from '../config';
import * as utils from '../main/utils';
import * as share from '../main/share';

const receivingSocket = zmq.socket('pull');
if(config.role === 'idp') receivingSocket.bindSync('tcp://*:' + config.msqRegister.port);

export const eventEmitter = new EventEmitter();

let msqQueue = {};
let blockchainQueue = {};

export checkIntegrity = async function(requestId) {
  //check hash, if hash match then pass to app layer
  if(msqQueue[requestId] && blockchainQueue[requestId]) {
    
    let msgBlockchain = blockchainQueue[requestId];
    let msqMsq = msqQueue[requestId];

    if(msgBlockchain.messageHash === await utils.hash(message.request_message)) {
      eventEmitter.emit('message', message);
    }
    else {
      console.error('Msq and blockchain not matched!!',hashedMsq,hashedBlockchain);
    }

    delete blockchainQueue[requestId];
    delete msqQueue[requestId];
  }
}

receivingSocket.on('message', function(jsonMessageStr){
  // TODO - Proper decrypt with private key
  jsonMessageStr = jsonMessageStr.toString().split('\\"').join('"');
  let decrypted = jsonMessageStr.slice(jsonMessageStr.indexOf('(') + 1
    , jsonMessageStr.length - 2);
  //console.log('===>',decrypted);

  const message = JSON.parse(decrypted);
  msqQueue[message.request_id] = message;
  checkIntegrity(message.request_id)
});

export const nodeLogicCallback = async (requestId) => {
  blockchainQueue[requestId] = await share.getRequest({
    requestId: message.request_id
  });
  checkIntegrity(requestId);
}

export const send = (receivers, message) => {
  receivers.forEach(receiver => {
    const sendingSocket = zmq.socket('push');
    sendingSocket.connect(`tcp://${receiver.ip}:${receiver.port}`);

    //TODO proper encrypt
    let encryptedMessage = 'Encrypt_with_' + receiver.public_key + '(' + 
      JSON.stringify(message) + 
    ')'
    sendingSocket.send(JSON.stringify(encryptedMessage));

    // TO BE REVISED
    // When should we disconnect the socket?
    // If the socket is disconnected, all the messages in queue will be lost. 
    // Hence, the receiver may not get the messages.
    sendingSocket.disconnect(`tcp://${receiver.ip}:${receiver.port}`);
  });
};
