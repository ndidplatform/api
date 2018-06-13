import EventEmitter from 'events';
import zmq from 'zeromq';

import logger from '../logger';

import * as config from '../config';
import * as utils from '../utils';
import CustomError from '../error/customError';
import * as tendermint from '../tendermint/ndid';

const receivingSocket = zmq.socket('pull');
receivingSocket.bindSync('tcp://*:' + config.mqRegister.port);

export const eventEmitter = new EventEmitter();

receivingSocket.on('message', async function(jsonMessageStr) {
  const jsonMessage = JSON.parse(jsonMessageStr);

  let decrypted = await utils.decryptAsymetricKey(jsonMessage);
  
  logger.debug({
    message: 'Raw decrypted message from message queue',
    decrypted,
  });

  //verify digital signature
  let [ raw_message, msqSignature ] = decrypted.split('|');

  logger.debug({
    message: 'Split msqSignature',
    raw_message,
    msqSignature,
  });

  let { idp_id, rp_id, as_id } = JSON.parse(raw_message);
  let nodeId = idp_id || rp_id || as_id ;
  let { public_key } = await getNodePubKey(nodeId);
  if(!nodeId) throw new CustomError({
    message: 'Receive message from unknown node',
  });

  let signatureValid = utils.verifySignature(
    msqSignature,
    public_key,
    raw_message,
  );

  logger.debug({
    message: 'Verify signature',
    msqSignature,
    public_key,
    raw_message,
    raw_message_object: JSON.parse(raw_message),
    signatureValid,
  });

  if(signatureValid) {
    eventEmitter.emit('message', raw_message);
  }
  else throw new CustomError({
    message: 'Receive message with unmatched digital signature',
  });
});

export const send = async (receivers, message) => {

  let msqSignature = await utils.createSignature(message);
  let realPayload = JSON.stringify(message) + '|' + msqSignature;

  logger.debug({
    message: 'Digital signature created',
    raw_message_object: message,
    msqSignature,
    realPayload,
  });

  receivers.forEach(async (receiver) => {
    const sendingSocket = zmq.socket('push');
    sendingSocket.connect(`tcp://${receiver.ip}:${receiver.port}`);

    //cannot add signature in object because JSON.stringify may produce different string
    //for two object that is deep equal, hence, verify signature return false
    let encryptedMessage = utils.encryptAsymetricKey(
      receiver.public_key,
      realPayload,
    );
    sendingSocket.send(JSON.stringify(encryptedMessage));

    // TO BE REVISED
    // When should we disconnect the socket?
    // If the socket is disconnected, all the messages in queue will be lost.
    // Hence, the receiver may not get the messages.
    sendingSocket.disconnect(`tcp://${receiver.ip}:${receiver.port}`);
  });
};

export function close() {
  receivingSocket.close();
  logger.info({
    message: 'Message queue socket closed',
  });
}

//cannot use common.js because circular dependency
async function getNodePubKey(node_id) {
  try {
    return await tendermint.query('GetNodePublicKey', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node public key from blockchain',
      cause: error,
    });
  }
}