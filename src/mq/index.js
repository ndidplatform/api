import EventEmitter from 'events';
import zmq from 'zeromq';
import logger from '../logger';

import * as config from '../config';
import * as utils from '../utils';

import CustomError from '../error/customError';
import * as tendermint from '../tendermint/ndid';

import MQSend from './mqsend.js';
import MQRecv from './mqrecv.js';

const mqSend = new MQSend({});
const mqRecv = new MQRecv({port: config.mqRegister.port});

export const eventEmitter = new EventEmitter();

mqRecv.on('message', async function(jsonMessageStr) {

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

    let encryptedMessage = utils.encryptAsymetricKey(
      receiver.public_key,
      realPayload,
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
