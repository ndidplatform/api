import fetch from 'node-fetch';
import * as utils from './utils';
import * as mq from '../mq';

var privKey = 'RP_PrivateKey';

let referenceMapping = {};
let callbackUrls = {};

export const handleNodeLogicCallback = async (requestId) => {
  if (callbackUrls[requestId]) {
    const request = await utils.queryChain('GetRequest', { requestId });

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

export async function createRequest({
  namespace,
  identifier,
  reference_id,
  ...data
}) {
  //existing reference_id, return
  if (referenceMapping[reference_id]) return referenceMapping[reference_id];

  let nonce = utils.getNonce();
  let request_id = await utils.createRequestId(privKey, data, nonce);

  //add data to blockchain
  let dataToBlockchain = {
    request_id,
    min_idp: data.minIdp ? data.minIdp : 1,
    min_aal: data.min_aal,
    min_ial: data.min_ial,
    timeout: data.timeout,
    data_request_list: data.data_request_list,
    message_hash: await utils.hash(data.request_message),
  };
  utils.updateChain('CreateRequest', dataToBlockchain, nonce);

  //query node_id and public_key to send data via msq
  getMsqDestination({
    namespace,
    identifier,
    min_ial: data.min_ial,
  }).then(async ({ node_id }) => {
    let receivers = [];

    //prepare data for msq
    for (let i in node_id) {
      let nodeId = node_id[i];
      let [ip, port] = nodeId.split(':');
      receivers.push({
        ip,
        port,
        ...(await getNodePubKey(nodeId)),
      });
    }

    //send via message queue
    mq.send(receivers, {
      namespace,
      identifier,
      request_id,
      min_idp: data.minIdp ? data.minIdp : 1,
      min_aal: data.min_aal ? data.min_aal : 1,
      min_ial: data.min_ial ? data.min_ial : 1,
      timeout: data.timeout,
      data_request_list: data.data_request_list,
      request_message: data.request_message,
    });
  });

  //maintain mapping
  referenceMapping[reference_id] = request_id;
  callbackUrls[request_id] = data.callback_url;
  return request_id;
}

export async function getMsqDestination(data) {
  return await utils.queryChain('GetMsqDestination', {
    hash_id: await utils.hash(data.namespace + ':' + data.identifier),
    min_ial: data.min_ial,
  });
}

export async function getNodePubKey(node_id) {
  return await utils.queryChain('GetNodePublicKey', { node_id });
}
