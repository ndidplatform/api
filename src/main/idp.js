import * as utils from './utils';

var privKey = 'IDP_PrivateKey';

/*
  data = {
    requestId:
    status: 'accept','reject'
  }
*/
export async function createIdpResponse(data) {
  data.signature = utils.createSignature(privKey,JSON.stringify(data));
  let result = await utils.updateChain('CreateIdpResponse',data,utils.getNonce());
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
