import * as utils from './utils';
import * as msq from '../msq/index';

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
  await utils.updateChain('CreateRequest',dataToSend,nonce);

  const idpList = await getMsqDestination({
    namespace, identifier
  });
  if(!idpList) idpList = [];
  await msq.send(idpList,data);
  
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
