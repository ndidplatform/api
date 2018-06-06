import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

import CustomError from '../error/customError';
import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as common from './common';
import * as utils from '../utils';
import * as config from '../config';
import * as db from '../db';
import * as mq from '../mq';
import * as identity from './identity';

const callbackUrlFilePath = path.join(
  __dirname,
  '..',
  '..',
  'idp-callback-url'
);
let callbackUrl = null;
try {
  callbackUrl = fs.readFileSync(callbackUrlFilePath, 'utf8');
} catch (error) {
  if (error.code === 'ENOENT') {
    logger.warn({
      message: 'IDP callback url file not found',
    });
  } else {
    logger.error({
      message: 'Cannot read IDP callback url file',
      error,
    });
  }
}

export const setCallbackUrl = (url) => {
  callbackUrl = url;
  fs.writeFile(callbackUrlFilePath, url, (err) => {
    if (err) {
      logger.error({
        message: 'Cannot write IDP callback url file',
        error: err,
      });
    }
  });
};

export const getCallbackUrl = () => {
  return callbackUrl;
};

export async function createIdpResponse(data) {
  try {
    let {
      request_id,
      //namespace,
      //identifier,
      aal,
      ial,
      status,
      signature,
      accessor_id,
      secret,
    } = data;
    
    let [blockchainProof, privateProofValue] = utils.generateIdentityProof({
      publicKey: await common.getAccessorKey(accessor_id),
      challenge: (await db.getRequestReceivedFromMQ(request_id)).challenge,
      secret,
    });
    await db.removeRequestReceivedFromMQ(request_id);

    let privateProofObject = {
      privateProofValue,
      accessor_id,
    };

    let dataToBlockchain = {
      request_id,
      aal,
      ial,
      status,
      signature,
      //accessor_id,
      identity_proof: blockchainProof,
      private_proof_hash: utils.hash(privateProofValue),
    };


    let { height } = await tendermint.transact(
      'CreateIdpResponse',
      dataToBlockchain,
      utils.getNonce()
    );

    sendPrivateProofToRP(request_id, privateProofObject, height);

  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create IDP response',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function notifyByCallback(request) {
  if (!callbackUrl) {
    logger.error({
      message: 'Callback URL for IDP has not been set',
    });
    return;
  }
  try {
    request.type = request.type || 'request';
    fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request }),
    });
  } catch (error) {
    logger.error({
      message: 'Cannot send callback to IDP',
    });

    // TODO: handle error
    // retry?

    // throw error;
  }
}

async function sendPrivateProofToRP(request_id, privateProofObject, height) {
  let rp_id = await db.getRPIdFromRequestId(request_id);

  logger.info({
    message: 'Query MQ destination for rp',
  });
  logger.debug({
    message: 'Query MQ destination for rp',
    rp_id
  });

  let { ip, port } = await common.getMsqAddress(rp_id);
  let rpMq = {
    ip,
    port,
    ...(await common.getNodePubKey(rp_id)),
  };

  mq.send([rpMq], {
    request_id,
    ...privateProofObject,
    height,
    idp_id: config.nodeId
  });

  db.removeRPIdFromRequestId(request_id);
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
  //need challenge for response
  await db.setRequestReceivedFromMQ(requestJson.request_id, requestJson);

  const latestBlockHeight = tendermint.latestBlockHeight;
  if (latestBlockHeight <= requestJson.height) {
    logger.debug({
      message: 'Saving message from MQ',
      tendermintLatestBlockHeight: latestBlockHeight,
      messageBlockHeight: requestJson.height,
    });
    await db.addRequestIdExpectedInBlock(
      requestJson.height,
      requestJson.request_id
    );
    await db.setRPIdFromRequestId(requestJson.request_id, requestJson.rp_id);

    if(requestJson.accessor_id) {
      //====================== COPY-PASTE from RP, need refactoring =====================
      //store private parameter from EACH idp to request, to pass along to as
      let request = await db.getRequestToSendToAS(requestJson.request_id);
      //AS involve
      if (request) {
        if (request.privateProofObjectList) {
          request.privateProofObjectList.push({
            idp_id: requestJson.idp_id,
            privateProofObject: {
              privateProofValue: requestJson.privateProofValue,
              accessor_id: requestJson.accessor_id,
            },
          });
        } else {
          request.privateProofObjectList = [
            {
              idp_id: requestJson.idp_id,
              privateProofObject: {
                privateProofValue: requestJson.privateProofValue,
                accessor_id: requestJson.accessor_id,
              },
            },
          ];
        }
        await db.setRequestToSendToAS(requestJson.request_id, request);
      }
      //====================================================================================
    }
    return;
  }

  logger.debug({
    message: 'Processing request',
    requestId: requestJson.request_id,
  });
  //onboard response
  if(requestJson.accessor_id) {
    if(await checkOnboardResponse(requestJson)) {
      await identity.addAccessorAfterConsent(requestJson.request_id, requestJson.accessor_id);
      notifyByCallback({
        type: 'onboard_request',
        request_id: requestJson.request_id,
        success: true,
      });
    }
  }
  else {
    const valid = await common.checkRequestIntegrity(
      requestJson.request_id,
      requestJson
    );
    if (valid) {
      notifyByCallback({
        //request_message_hash: utils.hash(requestJson.request_message),
        ...requestJson,
      });
    }
  }
}

export async function handleTendermintNewBlockHeaderEvent(
  error,
  result,
  missingBlockCount
) {
  const height = tendermint.getBlockHeightFromNewBlockHeaderEvent(result);

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
      //reposne for onboard
      if(message.accessor_id) {
        if(await checkOnboardResponse(message)) {
          await identity.addAccessorAfterConsent(message.request_id, message.accessor_id);
          notifyByCallback({
            type: 'onboard_request',
            request_id: message.request_id,
            success: true,
          });
        }
      }
      else {
        const valid = await common.checkRequestIntegrity(requestId, message);
        if (valid) {
          notifyByCallback({
            //request_message_hash: utils.hash(message.request_message),
            ...message,
          });
        }
        //need challenge when respond
        //db.removeRequestReceivedFromMQ(requestId);
      }
    })
  );

  db.removeRequestIdsExpectedInBlock(fromHeight, toHeight);
}

//===================== Initialize before flow can start =======================

export async function init() {
  //TODO
  //In production this should be done only once in phase 1,

  // Wait for blockchain ready
  await tendermint.ready;

  //when IDP request to join approved NDID
  //after first approved, IDP can add other key and node and endorse themself
  /*let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
  process.env.nodeId = node_id;
  common.addNodePubKey({
    node_id,
    public_key: 'very_secure_public_key_for_idp'
  });*/
  common.registerMsqAddress(config.mqRegister);
}

async function checkOnboardResponse(message) {
  let reason = false;
  let requestDetail = await common.getRequestDetail({
    requestId: message.request_id
  });
  let response = requestDetail.responses[0];
  
  if(!(await common.verifyZKProof(message.request_id, message.idp_id, message))) {
    reason = 'Invalid response';
  }
  else if(response.status !== 'accept') {
    reason = 'User rejected';
  }

  if(reason) {
    notifyByCallback({
      type: 'onboard_request',
      request_id: message.request_id,
      success: false,
      reason: reason
    });

    logger.debug({
      message: 'Onboarding failed',
      reason,
    });

    return false;
  }
  logger.debug({
    message: 'Onboard consented',
  });
  return true;
}