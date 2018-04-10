import * as utils from './utils';


var privKey = 'RP_PrivateKey';
/*
  data = {
    message:
    minIdp: default 1 (optional)
  }
*/
export async function createRequest({ namespace, identifier, ...data }) {
  let nonce = utils.getNonce();
  let requestId = await utils.createRequestId(privKey,data,nonce);

  let dataToSend = {
    requestId,
    messageHash: await utils.hash(data.message),
    minIdp: data.minIdp ? data.minIdp : 1
  };
  utils.updateChain('CreateRequest',dataToSend,nonce);

  const idpList = await getMsqDestination({
    namespace, identifier
  });

  // TODO
  // Send message using message queue
  
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
