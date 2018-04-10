import * as utils from './utils';
import * as msq from '../msq/index';

var privKey = 'RP_PrivateKey';

let referenceMapping = {};
let callbackMapping = {};

export async function createRequest({ namespace, identifier, ...data }) {
  if(referenceMapping[reference_id]) return referenceMapping[reference_id];

  let nonce = utils.getNonce();
  let request_id = await utils.createRequestId(privKey,data,nonce);

  let dataToBlockchain = {
    request_id,
    min_idp: data.minIdp ? data.minIdp : 1,
    min_aal: data.min_aal,
    min_ial: data.min_ial,
    timeout: data.timeout,
    data_request_list: data.data_request_list,
    message_hash: await utils.hash(data.request_message),
  };
  utils.updateChain('CreateRequest',dataToBlockchain,nonce);

  getMsqDestination({
    namespace,
    identifier, 
    min_ial: data.min_ial, 
    min_aal: data.min_aal
  })
  .then((idpList) => {
    let receivers = [];
    idpList.forEach((idp) => {
      receivers.push({
        ip: idp.split(':')[0],
        port: idp.split(':')[1],
        publicKey: idp.split(':')[2]
      })
    });

    msq.send(receivers, {
      namespace,
      identifier,
      request_id,
      min_idp: data.minIdp ? data.minIdp : 1,
      min_aal: data.min_aal,
      min_ial: data.min_ial,
      timeout: data.timeout,
      data_request_list: data.data_request_list,
      request_message: data.request_message
    });

  });
  
  referenceMapping[data.reference_id] = request_id;
  callbackMapping[request_id] = data.callback_url;
  return request_id;
}

/*
  data = {
    namespace:
    identifier:
    min_ial:
    min_aal:
  }
*/
export async function getMsqDestination(data) {
  return await utils.queryChain('GetMsqDestination',data);
}

export async function handleCallback(data) {
  
}
