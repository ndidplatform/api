import * as utils from './utils';

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

export async function handleMessageFromQueue(encryptedMessage) {
  //TODO
  //decrypyted with private_key
  //wait for blockchain to update and query blockchain with request_id
  //check integrity of message and from blockchain
  //notify user and request consent
}