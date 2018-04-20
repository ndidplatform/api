import EventEmitter from 'events';
import zmq from 'zeromq';
import * as config from '../config';
import * as utils from '../main/utils';

const receivingSocket = zmq.socket('pull');
console.log(config.mqRegister.port);
receivingSocket.bindSync('tcp://*:' + config.mqRegister.port);

export const eventEmitter = new EventEmitter();

receivingSocket.on('message', async function(jsonMessageStr) {
  const jsonMessage = JSON.parse(jsonMessageStr);

  // TODO Retrieve private key and proper decrypt
  let decrypted = await utils.decryptAsymetricKey(null, jsonMessage);
  eventEmitter.emit('message', decrypted);
});

export const send = async (receivers, message) => {
  receivers.forEach(async receiver => {
    const sendingSocket = zmq.socket('push');
    sendingSocket.connect(`tcp://${receiver.ip}:${receiver.port}`);

    // TODO proper encrypt
    let encryptedMessage = await utils.encryptAsymetricKey(
      receiver.public_key,
      JSON.stringify(message)
    );
    sendingSocket.send(JSON.stringify(encryptedMessage));

    // TO BE REVISED
    // When should we disconnect the socket?
    // If the socket is disconnected, all the messages in queue will be lost.
    // Hence, the receiver may not get the messages.
    sendingSocket.disconnect(`tcp://${receiver.ip}:${receiver.port}`);
  });
};
