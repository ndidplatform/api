import fetch from 'node-fetch';

import CustomError from '../error/customError';
import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as mq from '../mq';
import * as utils from '../utils';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';

async function sendDataToRP(data) {
  let receivers = [];
  let nodeId = data.rp_id;
  // TODO: try catch / error handling
  let { ip, port } = await common.getMsqAddress(nodeId);
  receivers.push({
    ip,
    port,
    ...(await common.getNodePubKey(nodeId)), // TODO: try catch / error handling
  });
  mq.send(receivers, {
    request_id: data.request_id,
    as_id: data.as_id,
    service_id: data.service_id,
    signature: data.signature,
    data: data.data,
  });
}

async function signData(data) {
  const nonce = utils.getNonce();
  const dataToBlockchain = {
    request_id: data.request_id,
    signature: data.signature,
    service_id: data.service_id,
  };
  try {
    await tendermint.transact('SignData', dataToBlockchain, nonce);
  } catch (error) {
    // TODO: handle error
    throw error;
  }
}

async function registerServiceDestination(data) {
  try {
    let nonce = utils.getNonce();
    await tendermint.transact('RegisterServiceDestination', data, nonce);
  } catch (error) {
    throw error;
  }
}

async function notifyByCallback(request, serviceId) {
  //get by persistent

  logger.debug({
    message: 'AS try to send data',
    request,
    serviceId,
  });

  let callbackUrl = await db.getServiceCallbackUrl(serviceId);
  //console.log('===>',callbackUrl);
  if (!callbackUrl) {
    logger.error({
      message: 'Callback URL for AS has not been set',
    });
    return;
  }

  logger.info({
    message: 'Sending callback to AS',
  });
  logger.debug({
    message: 'Callback to AS',
    request,
  });

  let responseFromAS;
  try {
    responseFromAS = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request }),
    });
  } catch (error) {
    logger.error({
      message: 'Cannot get data from AS',
      error,
    });

    // TODO: handle error
    // retry?
  }
  try {
    const result = await responseFromAS.json();

    logger.info({
      message: 'Received data from AS',
    });
    logger.debug({
      message: 'Data from AS',
      result,
    });

    return result.data;
  } catch (error) {
    logger.error({
      message: 'Cannot parse data from AS',
      error,
    });

    throw error;
  }
}

async function getResponseDetails(requestId) {
  const requestDetail = await common.getRequestDetail({
    requestId,
  });

  // TODO
  // Verify that (number of consent ≥ min_idp in request).
  // For each consent with matching request ID:
  // Verify the identity proof.
  // Verify the signature.
  // Verify that the message_hash is matching with the request.
  // Verify data_request_params with its hash

  // Get all signatures
  // and calculate max ial && max aal
  let signatures = [];
  let max_ial = 0;
  let max_aal = 0;
  requestDetail.responses.forEach((response) => {
    signatures.push(response.signature);
    if (response.aal > max_aal) max_aal = response.aal;
    if (response.ial > max_ial) max_ial = response.ial;
  });

  return {
    signatures,
    max_aal,
    max_ial,
  };
}

async function getDataAndSendBackToRP(requestJson, responseDetails) {
  // Platform→AS
  // The AS replies with the requested data
  logger.debug({
    message: 'AS process request for data',
    requestJson,
    responseDetails,
  });

  let data = await notifyByCallback(
    {
      request_id: requestJson.request_id,
      request_params: requestJson.request_params,
      ...responseDetails,
    },
    requestJson.service_id
  );

  // When received data
  let as_id = config.nodeId;
  let signature = await utils.createSignature(data);
  // AS node encrypts the response and sends it back to RP via NSQ.
  // TODO should check request status before send (whether request is closed or timeout)
  //console.log('===> AS SENDING');
  sendDataToRP({
    rp_id: requestJson.rp_id,
    request_id: requestJson.request_id,
    as_id,
    signature,
    service_id: requestJson.service_id,
    data,
  });
  //console.log('===> AS SENT');

  // AS node adds transaction to blockchain
  signData({
    as_id,
    request_id: requestJson.request_id,
    signature,
    service_id: requestJson.service_id,
  });
}

export async function handleMessageFromQueue(request) {
  logger.info({
    message: 'Received message from MQ',
  });
  logger.debug({
    message: 'Message from MQ',
    request,
  });
  const requestJson = JSON.parse(request);

  const latestBlockHeight = tendermint.latestBlockHeight;
  if (latestBlockHeight <= requestJson.height) {
    logger.debug({
      message: 'Saving message from MQ',
      tendermintLatestBlockHeight: latestBlockHeight,
      messageBlockHeight: requestJson.height,
    });
    await db.setRequestReceivedFromMQ(requestJson.request_id, requestJson);
    await db.addRequestIdExpectedInBlock(
      requestJson.height,
      requestJson.request_id
    );
    return;
  }

  logger.debug({
    message: 'Processing request',
    requestId: requestJson.request_id,
  });
  const valid = await common.checkRequestIntegrity(
    requestJson.request_id,
    requestJson
  );
  if (valid) {
    // TODO try catch / error handling
    const responseDetails = await getResponseDetails(requestJson.request_id);
    //loop and check zk proof for all response
    if(!verifyZKProof(requestJson.request_id, requestJson)) {
      //TODO, do not answer? or send data to rp and tell them proof is invalid?
      return;
    }
    getDataAndSendBackToRP(requestJson, responseDetails);
  }
}

export async function handleTendermintNewBlockHeaderEvent(
  error,
  result,
  missingBlockCount
) {
  const height = tendermint.getBlockHeightFromNewBlockHeaderEvent(result);
  //console.log('received',height);
  // messages that arrived before 'NewBlock' event
  // including messages between the start of missing block's height
  // and the block before latest block height
  // (not only just (current height - 1) in case 'NewBlock' events are missing)
  // NOTE: tendermint always create a pair of block. A block with transactions and
  // a block that signs the previous block which indicates that the previous block is valid
  const fromHeight =
    missingBlockCount == null
      ? 1
      : missingBlockCount === 0
        ? height - 1
        : height - missingBlockCount;
  const toHeight = height - 1;

  logger.debug({
    message: 'Getting request IDs to process',
    fromHeight,
    toHeight,
  });

  const requestIdsInTendermintBlock = await db.getRequestIdsExpectedInBlock(
    fromHeight,
    toHeight
  );
  await Promise.all(
    requestIdsInTendermintBlock.map(async (requestId) => {
      logger.debug({
        message: 'Processing request',
        requestId,
      });
      const message = await db.getRequestReceivedFromMQ(requestId);
      const valid = await common.checkRequestIntegrity(requestId, message);
      if (valid && verifyZKProof(requestId)) {
        const responseDetails = await getResponseDetails(requestId);
        getDataAndSendBackToRP(message, responseDetails);
      }
      db.removeRequestReceivedFromMQ(requestId);
    })
  );

  db.removeRequestIdsExpectedInBlock(fromHeight, toHeight);
}

export async function registerAsService({
  service_id,
  service_name,
  min_ial,
  min_aal,
  url,
}) {
  try {
    await Promise.all([
      registerServiceDestination({
        service_id,
        service_name,
        min_aal,
        min_ial,
        node_id: config.nodeId,
      }),
      //store callback to persistent
      db.setServiceCallbackUrl(service_id, url),
    ]);
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register AS service',
      cause: error,
    });
  }
}

export async function getServiceDetail(service_id) {
  try {
    const result = await tendermint.query('GetServiceDetail', {
      service_id,
      node_id: config.nodeId,
    });
    return result
      ? {
          service_id,
          url: await db.getServiceCallbackUrl(service_id),
          ...result,
        }
      : null;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get service details',
      cause: error,
    });
  }
}

//===================== Initialize before flow can start =======================

export async function init() {
  // In production environment, this should be done with register service process.

  // Wait for blockchain ready
  await tendermint.ready;

  // TODO
  //register node id, which is substituted with ip,port for demo
  //let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
  //process.env.nodeId = node_id;
  // Hard code add back statement service for demo
  /*registerServiceDestination({
    //as_id: config.asID,
    service_id: 'bank_statement',
    node_id: config.nodeId,
  });*/
  common.registerMsqAddress(config.mqRegister);
  /*common.addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key_for_as'
  });*/
}

async function verifyZKProof(request_id, dataFromMq) {
  if(!dataFromMq) dataFromMq = await db.getRequestReceivedFromMQ(request_id);
  let {
    privateProofObjectList,
    namespace,
    identifier,
    request_message,
  } = dataFromMq;

  //query and verify zk, also check conflict with each others
  let accessor_group_id = await common.getAccessorGroupId(
    privateProofObjectList[0].privateProofObject.accessor_id
  );
  for(let i = 1 ; i < privateProofObjectList.length ; i++) {
    let otherGroupId = await common.getAccessorGroupId(
      privateProofObjectList[i].privateProofObject.accessor_id
    );
    if(otherGroupId !== accessor_group_id) {
      //TODO handle this?
      //throw 'Conflicted response';
      return false;
    }
  }

  let responses = (await common.getRequestDetail({
    requestId: request_id
  })).responses;
  let valid = true;
  for(let i = 0 ; i < privateProofObjectList.length ; i++) {
    //query accessor_public_key from privateProof.accessor_id
    let public_key = await common.getAccessorKey(
      privateProofObjectList[i].privateProofObject.accessor_id
    );
    //query publicProof from response of idp_id in request
    let publicProof,signature,privateProofValueHash;
    responses.forEach((response) => {
      if(response.idp_id === privateProofObjectList[i].idp_id) {
        publicProof = response.identity_proof;
        signature = response.signature;
        privateProofValueHash = response.private_proof_hash;
      }
    });

    let signatureValid = utils.verifySignature(
      signature, 
      public_key, 
      request_message
    );
  
    logger.debug({
      message: 'Verify signature',
      signatureValid,
      request_message,
      public_key,
      signature,
    });

    valid &= signatureValid;

    valid &= utils.verifyZKProof(
      public_key, 
      dataFromMq.challenge, 
      privateProofObjectList[i].privateProofObject.privateProofValue, 
      publicProof,
      {
        namespace,
        identifier
      },
      privateProofValueHash,
    );
  }
  return valid;
}