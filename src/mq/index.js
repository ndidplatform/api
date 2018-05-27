import EventEmitter from 'events';
import zmq from 'zeromq';
import * as config from '../config';
import * as utils from '../main/utils';
import MQSend from './mqsend.js';
import MQRecv from './mqrecv.js';

const mqSend = new MQSend({});
const mqRecv = new MQRecv({port: config.mqRegister.port});


export const eventEmitter = new EventEmitter();

mqRecv.on('message', async function(jsonMessageStr) {

  const jsonMessage = JSON.parse(jsonMessageStr);

  // TODO Retrieve private key and proper decrypt
  let decrypted = await utils.decryptAsymetricKey(null, jsonMessage);
  eventEmitter.emit('message', decrypted);
});

export const send = async (receivers, message) => {
  receivers.forEach(async receiver => {
    const sendingSocket = zmq.socket('req');
    sendingSocket.connect(`tcp://${receiver.ip}:${receiver.port}`);

    // TODO proper encrypt
    let encryptedMessage = await utils.encryptAsymetricKey(
      receiver.public_key,
      JSON.stringify(message)
    );

    mqSend.send(receiver, JSON.stringify(encryptedMessage));

  });
};
