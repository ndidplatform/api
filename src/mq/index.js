import EventEmitter from 'events';
import zmq from 'zeromq';
import * as config from '../config';
import * as utils from '../utils';
import MQNode from './mqnode'

const mqNode = new MQNode({port: config.mqRegister.port});

export const eventEmitter = new EventEmitter();

mqNode.on('message', async function(jsonMessageStr) {
  const jsonMessage = JSON.parse(jsonMessageStr);

  let decrypted = utils.decryptAsymetricKey(jsonMessage);
  eventEmitter.emit('message', decrypted);
});

export const send = async (receivers, message) => {
  receivers.forEach(async (receiver) => {
    const sendingSocket = zmq.socket('req');
    sendingSocket.connect(`tcp://${receiver.ip}:${receiver.port}`);

    // TODO proper encrypt
    let encryptedMessage = utils.encryptAsymetricKey(
      receiver.public_key,
      JSON.stringify(message)
    );
    mqNode.send(receiver, JSON.stringify(encryptedMessage));
  });
};
