import fetch from 'node-fetch';

import * as utils from './utils';
import * as msq from '../msq/index';

var privKey = 'RP_PrivateKey';

const callbackUrls = {};

export const handleNodeLogicCallback = async (requestId) => {
  if (callbackUrls[requestId]) {
    const queryResponse = await utils.queryChain('GetRequest', { requestId });

    const jsonStr = Buffer.from(
      queryResponse.result.response.value,
      'base64'
    ).toString();
    const request = JSON.parse(jsonStr);

    try {
      await fetch(callbackUrls[requestId], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request,
        }),
      });
    } catch (error) {
      console.log(
        'Cannot send callback to client application with the following error:',
        error
      );
    }
    
    // Clear callback url mapping when the request is no longer going to have further events
    if (request.status === 'completed' || request.status === 'rejected') {
      delete callbackUrls[requestId];
    }
  }
};

/*
  data = {
    message:
    minIdp: default 1 (optional)
  }
*/
export async function createRequest({ namespace, identifier, ...data }) {
  let nonce = utils.getNonce();
  let requestId = await utils.createRequestId(privKey, data, nonce);

  let dataToSend = {
    requestId,
    messageHash: await utils.hash(data.request_message),
    minIdp: data.minIdp ? data.minIdp : 1,
  };
  await utils.updateChain('CreateRequest', dataToSend, nonce);

  const idpList = await getMsqDestination({
    namespace,
    identifier,
  });
  if (!idpList) idpList = [];
  await msq.send(idpList, {
    namespace,
    identifier,
    ...data,
    requestId,
  });

  callbackUrls[requestId] = data.callback_url;

  return requestId;
}

/*
  data = {
    namespace:
    identifier
  }
*/
export async function getMsqDestination(data) {
  return await utils.queryChain('GetMsqDestination', data);
}
