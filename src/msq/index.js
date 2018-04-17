import EventEmitter from 'events';
import zmq from 'zeromq';
import * as config from '../config';

const receivingSocket = zmq.socket('pull');
if(config.role === 'idp') receivingSocket.bindSync('tcp://*:' + config.msqRegister.port);

export const eventEmitter = new EventEmitter();

receivingSocket.on('message', function(jsonMessageStr){
  // TODO - Decrypt with provate key

  const message = JSON.parse(jsonMessageStr);
  //check hash, if hash match then pass to app layer

  eventEmitter.emit('message', message);
});

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
