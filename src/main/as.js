import * as mq from '../mq';
import * as utils from './utils';
import { eventEmitter } from '../mq';

export async function handleMessageFromQueue(request) {
  console.log('AS receive message from msq:', request);
  let requestJson = JSON.parse(request);

  const requestDetail = await utils.queryChain('GetRequestDetail', {
    requestId: requestJson.request_id
  });

  // TODO
  // Verify that (number of consent ≥ min_idp in request).
  // For each consent with matching request ID:
  // Verify the identity proof.
  // Verify the signature.
  // Verify that the message_hash is matching with the request.

  // Get all signature
  let signatures = [];
  requestDetail.responses.forEach(response => {
    signatures.push(response.signature);
  });

  // Calculate max ial && max aal
  let max_ial = 0;
  let max_aal = 0;
  requestDetail.responses.forEach(response => {
    if (response.aal > max_aal) max_aal = response.aal;
    if (response.ial > max_ial) max_ial = response.ial;
  });

  // Then callback to AS.
  console.log('Callback to AS', {
    request_id: requestJson.request_id,
    request_params: requestJson.request_params,
    signatures,
    max_ial,
    max_aal
  });

  // AS→Platform
  // The AS replies synchronously with the requested data

  // When received data
  let data = 'mock data';
  let as_id = 'AS1';
  let signature = 'sign(<PDF BINARY DATA>, AS1’s private key)';
  // AS node encrypts the response and sends it back to RP via NSQ.
  sendDataToRP({ rp_node_id: requestJson.rp_node_id, as_id, data });

  // AS node adds transaction to blockchain
  signData({ as_id, request_id: requestJson.request_id, signature });
}

async function sendDataToRP(data) {
  console.log(data);
  let receivers = [];
  let nodeId = data.rp_node_id;
  let [ip, port] = nodeId.split(':');
  receivers.push({
    ip,
    port,
    public_key: 'public_key'
  });
  mq.send(receivers, {
    as_id: data.as_id,
    data: data.data
  });
}

async function signData(data) {
  let nonce = utils.getNonce();
  let dataToBlockchain = {
    as_id: data.as_id,
    request_id: data.request_id,
    signature: data.signature
  };
  utils.updateChain('SignData', dataToBlockchain, nonce);
}

export async function handleABCIAppCallback(requestId) {
  console.log('Callback (event) from ABCI app; requestId:', requestId);
  // TODO
}

//===================== Initialize before flow can start =======================

export async function init() {
  // Users associate with this idp
  // In production environment, this should be done with onboarding process.
  // TODO
  // let userList = JSON.parse(
  //   fs.readFileSync(process.env.ASSOC_USERS, 'utf8').toString()
  // );

  // let users = [];
  // for (let i in userList) {
  //   let elem = userList[i];
  //   users.push({
  //     hash_id: await utils.hash(elem.namespace + ':' + elem.identifier),
  //     ial: elem.ial,
  //   });
  // }
  // let node_id = config.msqRegister.ip + ':' + config.msqRegister.port;

  // //register node id, which is substituted with ip,port for demo
  // registerMsqDestination({
  //   users,
  //   node_id,
  // });

  // addNodePubKey({
  //   node_id,
  //   public_key: 'very_secure_public_key',
  // });

  eventEmitter.on('message', function(message) {
    handleMessageFromQueue(message);
  });
}
