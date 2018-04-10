import * as utils from './utils';


var privKey = 'RP_PrivateKey';
/*
  data = {
    message:
    minIdp: default 1 (optional)
  }
*/
export async function createRequest(data) {
  let nonce = utils.getNonce();
  let requestId = await utils.createRequestId(privKey,data,nonce);

  let dataToSend = {
    requestId,
    messageHash: await utils.hash(data.message),
    minIdp: data.minIdp ? data.minIdp : 1
  };
  utils.updateChain('CreateRequest',dataToSend,nonce);
  //send message queue to idp
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
