import EventEmitter from 'events';
import zmq from 'zeromq';

import logger from '../logger';

import * as config from '../config';
import * as utils from '../utils';
import MQSend from './mqsend.js';
import MQRecv from './mqrecv.js';

const mqSend = new MQSend({});
const mqRecv = new MQRecv({port: config.mqRegister.port});


export const eventEmitter = new EventEmitter();

mqRecv.on('message', async function(jsonMessageStr) {

  const jsonMessage = JSON.parse(jsonMessageStr);

  let decrypted = await utils.decryptAsymetricKey(jsonMessage);
  eventEmitter.emit('message', decrypted);
});

export const send = async (receivers, message) => {
  receivers.forEach(async (receiver) => {
    // TODO proper encrypt
    let encryptedMessage = utils.encryptAsymetricKey(
      receiver.public_key,
      JSON.stringify(message)
    );

    mqSend.send(receiver, JSON.stringify(encryptedMessage));

  });
};

export function close() {
  mqRecv.close();
  logger.info({
    message: 'Message queue socket closed',
  });
}
