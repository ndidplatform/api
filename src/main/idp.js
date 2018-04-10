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
  return await utils.updateChain('CreateIdpResponse',data,utils.getNonce());
}
