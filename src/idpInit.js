import fs from 'fs';
import registerMsqDestination from './main/idp';
import eventEmitter from './msq/index';

export async function idpInit() {
  let userList = JSON.parse(
    fs.readFileSync(process.env.ASSOC_USERS,'utf8').toString()
  );

  registerMsqDestination({
    users: userList,
    ip: config.msqRegister.ip,
    port: config.msqRegister.port
  });

  eventEmitter.on('message',function(message) {
    //Handle message here
    console.log('IDP receive message from msq:',message);
  });
}