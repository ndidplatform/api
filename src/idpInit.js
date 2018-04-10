import fs from 'fs';
import { registerMsqDestination, handleMessageFromQueue } from './main/idp';
import { eventEmitter } from './msq/index';
import * as config from './config';

export async function init() {
  let userList = JSON.parse(
    fs.readFileSync(process.env.ASSOC_USERS,'utf8').toString()
  );

  registerMsqDestination({
    users: userList,
    ip: config.msqRegister.ip,
    port: config.msqRegister.port,
    publicKey: 'super-secure-publicKey'
  });

  eventEmitter.on('message',function(message) {
    console.log('IDP receive message from msq:',message);
    handleMessageFromQueue(message);
  });
}