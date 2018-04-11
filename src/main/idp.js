import * as utils from './utils';
import * as config from '../config';
import { eventEmitter } from '../msq/index';
import fs from 'fs';

var privKey = 'IDP_PrivateKey';

export async function createIdpResponse(data) {
  let {
    request_id,
    namespace,
    identifier,
    aal,
    ial,
    status,
    signature
  } = data;

  let dataToBlockchain = {
    request_id,
    aal,
    ial,
    status,
    signature,
    accessor_id: utils.getAccessorId(namespace,identifier),
    identity_proof: utils.generateIdentityProof(data)
  }
  let result = await utils.updateChain(
    'CreateIdpResponse',dataToBlockchain,utils.getNonce()
  );
  return result;
}

/*
  data = {
    users: [{
      namespace:
      identifier:
    },...]
    ip: string,
    port: string
  }
*/
export async function registerMsqDestination(data) {
  let result = await utils.updateChain('RegisterMsqDestination',data,utils.getNonce());
  return result;
}

export async function addNodePubKey(data) {
  let result = await utils.updateChain('AddNodePublicKey',data,utils.getNonce());
  return result;
}

export async function handleMessageFromQueue(encryptedMessage) {
  //TODO
  //decrypyted with private_key
  //wait for blockchain to update and query blockchain with request_id
  //check integrity of message and from blockchain
  //notify user and request consent
}

//===================== Initialize before flow can start =======================

export async function init() {
  //users associate with this idp
  let userList = JSON.parse(
    fs.readFileSync(process.env.ASSOC_USERS,'utf8').toString()
  );

  let users = userList.map((elem) => {
    return {
      hash_id: utils.hash(elem.namespace + ':' + elem.identifier),
      ial: elem.ial
    }
  });
  let node_id = config.msqRegister.ip + ':' + config.msqRegister.port;

  //register node id, which is substituted with ip,port for demo
  registerMsqDestination({
    user,
    node_id,
  });

  addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key'
  });

  eventEmitter.on('message',function(message) {
    console.log('IDP receive encrypted message from msq:',message);
    handleMessageFromQueue(message);
  });
}

if(config.isIdp) {
  init();
}