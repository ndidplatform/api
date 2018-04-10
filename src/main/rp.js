import utils from './utils';


var privKey = 'RP_PrivateKey';
/*
  data = {
    message:
    minIdp: default 1 (optional)
  }
*/
export async function createRequest(data) {
  let nonce = utils.getNonce();
  let requestId = utils.createRequestId(privKey,data,nonce);
  utils.updateChain('CreateRequest',data,nonce);
  return requestId;
}

/*
  data = {
    namespace:
    identifier
  }
*/
export async function getMsqDestination(data) {
  return await utils.queryChain('GetMsqDestination',data);
}
