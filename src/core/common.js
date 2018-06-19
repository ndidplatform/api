import CustomError from '../error/customError';
import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as rp from './rp';
import * as idp from './idp';
import * as as from './as';
import { eventEmitter as messageQueueEvent } from '../mq';
import { resumeCallbackToClient } from '../utils/callback';
import * as utils from '../utils';
import * as config from '../config';
import errorType from '../error/type';
import * as mq from '../mq';
import * as db from '../db';

const role = config.role;
const nodeId = config.nodeId;

let handleMessageFromQueue;
if (role === 'rp') {
  handleMessageFromQueue = rp.handleMessageFromQueue;
  tendermint.setTendermintNewBlockHeaderEventHandler(
    rp.handleTendermintNewBlockHeaderEvent
  );
  resumeTimeoutScheduler();
  resumeCallbackToClient();
} else if (role === 'idp') {
  handleMessageFromQueue = idp.handleMessageFromQueue;
  tendermint.setTendermintNewBlockHeaderEventHandler(
    idp.handleTendermintNewBlockHeaderEvent
  );
  resumeTimeoutScheduler();
  resumeCallbackToClient();
} else if (role === 'as') {
  handleMessageFromQueue = as.handleMessageFromQueue;
  tendermint.setTendermintNewBlockHeaderEventHandler(
    as.handleTendermintNewBlockHeaderEvent
  );
  resumeCallbackToClient(as.afterGotDataFromCallback);
}

async function resumeTimeoutScheduler() {
  let scheduler = await db.getAllTimeoutScheduler();
  scheduler.forEach(({ requestId, unixTimeout }) => 
    runTimeoutScheduler(requestId, (unixTimeout - Date.now()) / 1000)
  );
}

export async function getRequest({ requestId }) {
  try {
    return await tendermint.query('GetRequest', { requestId });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get request from blockchain',
      cause: error,
    });
  }
}

export async function getRequestDetail({ requestId }) {
  try {
    const { special, ...requestDetail } = await tendermint.query(
      'GetRequestDetail',
      { requestId }
    );
    if (requestDetail == null) {
      return null;
    }
    const requestStatus = utils.getDetailedRequestStatus(requestDetail);
    return {
      ...requestDetail,
      status: requestStatus.status,
    };
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get request details from blockchain',
      cause: error,
    });
  }
}

export async function getIdpNodes({ namespace, identifier, min_ial, min_aal }) {
  try {
    const result = await tendermint.query('GetIdpNodes', {
      hash_id:
        namespace && identifier
          ? utils.hash(namespace + ':' + identifier)
          : undefined,
      min_ial: parseInt(min_ial),
      min_aal: parseInt(min_aal),
    });
    return result != null ? (result.node != null ? result.node : []) : [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get IdP nodes from blockchain',
      cause: error,
    });
  }
}

export async function getAsNodesByServiceId({ service_id }) {
  try {
    const result = await tendermint.query('GetAsNodesByServiceId', {
      service_id,
    });
    return result != null ? (result.node != null ? result.node : []) : [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get AS nodes by service ID from blockchain',
      cause: error,
    });
  }
}

/**
 *
 * @param {Object} data
 * @param {string} data.node_id
 * @param {string} data.public_key
 */
export async function addNodePubKey(data) {
  try {
    const result = await tendermint.transact(
      'AddNodePublicKey',
      data,
      utils.getNonce()
    );
    return result;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot add node public key to blockchain',
      cause: error,
    });
  }
}

export async function getNodePubKey(node_id) {
  try {
    return await tendermint.query('GetNodePublicKey', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node public key from blockchain',
      cause: error,
    });
  }
}

export async function getMsqAddress(node_id) {
  try {
    return await tendermint.query('GetMsqAddress', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get message queue address from blockchain',
      cause: error,
    });
  }
}

export async function registerMsqAddress({ ip, port }) {
  try {
    return await tendermint.transact(
      'RegisterMsqAddress',
      {
        ip,
        port,
        node_id: nodeId,
      },
      utils.getNonce()
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register message queue address to blockchain',
      cause: error,
    });
  }
}

export async function getNodeToken(node_id = nodeId) {
  try {
    return await tendermint.query('GetNodeToken', { node_id });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get node token from blockchain',
      cause: error,
    });
  }
}

export async function checkRequestIntegrity(requestId, request) {
  const msgBlockchain = await getRequest({ requestId });

  const valid = 
    utils.hash(request.secretSalt + request.request_message)
    === msgBlockchain.request_message_hash;
  /*utils.compareSaltedHash({
    saltedHash: msgBlockchain.messageHash,
    plain: request.request_message,
  });*/
  if (!valid) {
    logger.warn({
      message: 'Request message hash mismatched',
      requestId,
    });
    logger.debug({
      message: 'Request message hash mismatched',
      requestId,
      givenRequestMessage: request.request_message,
      givenRequestMessageHashWithSalt: utils.hash(request.secretSalt + request.request_message),
      requestMessageHashFromBlockchain: msgBlockchain.request_message_hash,
    });
  }

  return valid;
}

export async function getNamespaceList() {
  try {
    return (await tendermint.query('GetNamespaceList')) || [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get namespace list from blockchain',
      cause: error,
    });
  }
}

export async function getServiceList() {
  try {
    return (await tendermint.query('GetServiceList')) || [];
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get service list from blockchain',
      cause: error,
    });
  }
}

if (handleMessageFromQueue) {
  messageQueueEvent.on('message', handleMessageFromQueue);
}

export async function getAccessorGroupId(accessor_id) {
  try {
    const accessorGroupIdObj = await tendermint.query('GetAccessorGroupID',{
      accessor_id,
    });
    if (accessorGroupIdObj == null) {
      return null;
    }
    return accessorGroupIdObj.accessor_group_id;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get accessor group ID from blockchain',
      cause: error,
    });
  }
}

export async function getAccessorKey(accessor_id) {
  try {
    const accessorPubKeyObj = await tendermint.query('GetAccessorKey',{
      accessor_id,
    });
    if (accessorPubKeyObj == null) {
      return null;
    }
    return accessorPubKeyObj.accessor_public_key;
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get accessor public key from blockchain',
      cause: error,
    });
  }
}

export async function getIdpsMsqDestination({
  namespace,
  identifier,
  min_ial,
  min_aal,
  idp_id_list,
  mode,
}) {
  const idpNodes = await getIdpNodes({
    namespace: mode === 3 
      ? namespace
      : undefined,
    identifier: mode === 3 
      ? identifier
      : undefined,
    min_ial,
    min_aal,
  });

  let filteredIdpNodes;
  if (idp_id_list != null && idp_id_list.length !== 0) {
    filteredIdpNodes = idpNodes.filter(
      (idpNode) => idp_id_list.indexOf(idpNode.node_id) >= 0
    );
  } else {
    filteredIdpNodes = idpNodes;
  }

  const receivers = await Promise.all(
    filteredIdpNodes.map(async (idpNode) => {
      const nodeId = idpNode.node_id;
      const { ip, port } = await getMsqAddress(nodeId);
      return {
        ip,
        port,
        ...(await getNodePubKey(nodeId)),
      };
    })
  );
  return receivers;
}

//=========================================== Request related ========================================

export let timeoutScheduler = {};

export function clearAllScheduler() {
  for (let requestId in timeoutScheduler) {
    clearTimeout(timeoutScheduler[requestId]);
  }
}

export async function timeoutRequest(requestId) {
  try {
    const responseValidList = await db.getIdpResponseValidList(requestId);

    const request = await getRequest({ requestId });
    if (request.closed === false) {
      await tendermint.transact(
        'TimeOutRequest',
        { requestId, response_valid_list: responseValidList },
        utils.getNonce()
      );
    }
  } catch (error) {
    logger.error({
      message: 'Cannot set timed out',
      requestId,
      error,
    });
    throw error;
  }
  db.removeTimeoutScheduler(requestId);
}

export function runTimeoutScheduler(requestId, secondsToTimeout) {
  if (secondsToTimeout < 0) timeoutRequest(requestId);
  else {
    timeoutScheduler[requestId] = setTimeout(() => {
      timeoutRequest(requestId);
    }, secondsToTimeout * 1000);
  }
}

export function addTimeoutScheduler(requestId, secondsToTimeout) {
  let unixTimeout = Date.now() + secondsToTimeout * 1000;
  db.addTimeoutScheduler(requestId, unixTimeout);
  runTimeoutScheduler(requestId, secondsToTimeout);
}

/**
 * Create a new request
 * @param {Object} request
 * @param {string} request.namespace
 * @param {string} request.reference_id
 * @param {Array.<string>} request.idp_id_list
 * @param {string} request.callback_url
 * @param {Array.<Object>} request.data_request_list
 * @param {string} request.request_message
 * @param {number} request.min_ial
 * @param {number} request.min_aal
 * @param {number} request.min_idp
 * @param {number} request.request_timeout
 * @returns {Promise<string>} Request ID
 */
export async function createRequest({
  mode,
  namespace,
  identifier,
  reference_id,
  idp_id_list,
  callback_url,
  data_request_list,
  request_message,
  min_ial,
  min_aal,
  min_idp,
  request_timeout,
}) {
  try {
    mode = mode || 3;
    // existing reference_id, return request ID
    const requestId = await db.getRequestIdByReferenceId(reference_id);
    if (requestId) {
      return requestId;
    }

    if (idp_id_list != null && idp_id_list.length > 0 && idp_id_list.length < min_idp) {
      throw new CustomError({
        message: errorType.IDP_LIST_LESS_THAN_MIN_IDP.message,
        code: errorType.IDP_LIST_LESS_THAN_MIN_IDP.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
        },
      });
    }



    let receivers = await getIdpsMsqDestination({
      namespace,
      identifier,
      min_ial,
      min_aal,
      idp_id_list,
      mode,
    });

    if (receivers.length === 0 && min_idp !== 0) {
      throw new CustomError({
        message: errorType.NO_IDP_FOUND.message,
        code: errorType.NO_IDP_FOUND.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
        },
      });
    }

    if (receivers.length < min_idp) {
      throw new CustomError({
        message: errorType.NOT_ENOUGH_IDP.message,
        code: errorType.NOT_ENOUGH_IDP.code,
        clientError: true,
        details: {
          namespace,
          identifier,
          idp_id_list,
        },
      });
    }

    const nonce = utils.getNonce();
    const request_id = utils.createRequestId();

    const dataRequestListToBlockchain = [];
    for (let i in data_request_list) {
      dataRequestListToBlockchain.push({
        service_id: data_request_list[i].service_id,
        as_id_list: data_request_list[i].as_id_list,
        min_as: data_request_list[i].min_as,
        request_params_hash: utils.hashWithRandomSalt(
          data_request_list[i].request_params
        ),
      });
    }

    let challenge = [
      utils.randomBase64Bytes(config.challengeLength),
      utils.randomBase64Bytes(config.challengeLength),
    ];
    db.setChallengeFromRequestId(request_id, challenge);

    let secretSalt = utils.randomBase64Bytes(16);

    const requestData = {
      namespace,
      identifier,
      request_id,
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list: data_request_list,
      request_message,
      mode,
      // for zk proof
      //challenge,
      rp_id: config.nodeId,
      secretSalt,
    };

    // save request data to DB to send to AS via mq when authen complete
    // store even no data require, use for zk proof
    //if (data_request_list != null && data_request_list.length !== 0) {
    await db.setRequestData(request_id, requestData);
    //}

    // add data to blockchain
    const requestDataToBlockchain = {
      request_id,
      min_idp,
      min_aal,
      min_ial,
      request_timeout,
      data_request_list: dataRequestListToBlockchain,
      request_message_hash: utils.hash(secretSalt + request_message),
      mode,
    };

    // maintain mapping
    await db.setRequestIdByReferenceId(reference_id, request_id);
    await db.setRequestCallbackUrl(request_id, callback_url);

    try {
      const { height } = await tendermint.transact(
        'CreateRequest',
        requestDataToBlockchain,
        nonce
      );

      // send request data to IDPs via message queue
      mq.send(receivers, {
        ...requestData,
        height,
      });
    } catch (error) {
      await db.removeRequestIdByReferenceId(reference_id);
      await db.removeRequestCallbackUrl(request_id);
      throw error;
    }

    addTimeoutScheduler(request_id, request_timeout);

    return request_id;
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create request',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

export async function verifyZKProof(request_id, idp_id, dataFromMq, mode) {

  let {
    namespace,
    identifier,
    privateProofObjectList,
    request_message,
  } = await db.getRequestData(request_id);

  //check only signature of idp_id
  if(mode === 1) { return true;

    /*let response_list = (await getRequestDetail({
      requestId: request_id,
    })).response_list;
    for(let i = 0 ; i < response_list.length ; i++) {
      if(response_list[i].idp_id !== idp_id) continue;

      let { signature } = response_list[i];
      let { public_key } = await getNodePubKey(idp_id);

      logger.debug({
        message: 'Verify signature, mode 1',
        signature,
        public_key,
        request_message,
        idp_id,
      });

      if(!utils.verifySignature(signature, public_key, JSON.stringify(request_message))) return false;
      else return true;
    }
    //should not reach (idp_id not found)
    logger.debug({
      message: 'Code should never reach here (in common.verifyZKProof)',
      request_id, idp_id, dataFromMq, mode,
    });
    return false;*/
  }

  let challenge = await db.getChallengeFromRequestId(request_id);
  let privateProofObject = dataFromMq
    ? dataFromMq
    : await db.getPrivateProofReceivedFromMQ(request_id + ':' + idp_id);

  logger.debug({
    message: 'Verifying zk proof',
    request_id,
    idp_id,
    dataFromMq,
    challenge,
    privateProofObject,
    mode,
  });

  //query accessor_group_id of this accessor_id
  let accessor_group_id = await getAccessorGroupId(
    privateProofObject.accessor_id
  );

  logger.debug({
    message: 'Verifying zk proof',
    privateProofObjectList,
  });

  //and check against all accessor_group_id of responses
  for (let i = 0; i < privateProofObjectList.length; i++) {
    let otherPrivateProofObject = privateProofObjectList[i].privateProofObject;
    let otherGroupId = await getAccessorGroupId(
      otherPrivateProofObject.accessor_id
    );
    if (otherGroupId !== accessor_group_id) {
      //TODO handle this, manually close?
      logger.debug({
        message: 'Conflict response',
        otherGroupId,
        otherPrivateProofObject,
        accessor_group_id,
        accessorId: privateProofObject.accessor_id,
      });
      throw 'Conflicted response';
    }
  }

  //query accessor_public_key from privateProofObject.accessor_id
  let public_key = await getAccessorKey(privateProofObject.accessor_id);

  //query publicProof from response of idp_id in request
  let publicProof, signature, privateProofValueHash;
  let response_list = (await getRequestDetail({
    requestId: request_id,
  })).response_list;

  logger.debug({
    message: 'Request detail',
    response_list,
    request_message,
  });

  response_list.forEach((response) => {
    if (response.idp_id === idp_id) {
      publicProof = JSON.parse(response.identity_proof);
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

  return (
    signatureValid &&
    utils.verifyZKProof(
      public_key,
      challenge,
      privateProofObject.privateProofValueArray,
      publicProof,
      {
        namespace,
        identifier,
      },
      privateProofValueHash,
      privateProofObject.padding,
    )
  );
}

//===== zkp and request related =====

export async function handleChallengeRequest(responseId) {

  logger.debug({
    message: 'Handle challenge request'
  });

  let [ request_id, idp_id ] = responseId.split(':');

  //get public proof from mq
  let public_proof_mq = await db.getPublicProofReceivedFromMQ(responseId);

  logger.debug({
    message: 'Public proof from MQ',
    public_proof_mq,
    responseId,
  });

  //message queue not arrived yet
  if(!public_proof_mq) return false;

  //get public proof in blockchain
  let public_proof_blockchain = JSON.parse((await tendermint.query(
    'GetIdentityProof',
    {
      request_id,
      idp_id,
    }
  )).identity_proof);
  if(!public_proof_blockchain) return false;

  //check public proof in blockchain and in message queue
  if(public_proof_blockchain.length !== public_proof_mq.length) return false;
  for(let i = 0; i < public_proof_mq.length ; i++) {
    if(public_proof_blockchain[i] !== public_proof_mq[i]) return false;
  }

  //if match, send challenge and return
  let nodeId = {};
  if(config.role === 'idp') nodeId.idp_id = config.nodeId;
  else if(config.role === 'rp') nodeId.rp_id = config.nodeId;
  let challenge = await db.getChallengeFromRequestId(request_id);
  logger.debug({
    message: 'Get challenge',
    challenge,
  });
  let { ip, port } = await getMsqAddress(idp_id);
  let receiver = [{
    ip,
    port,
    ...(await getNodePubKey(idp_id)),
  }];
  mq.send(receiver, {
    challenge,
    request_id,
    ...nodeId,
  });
}
export async function getIdentityInfo(namespace, identifier, node_id) {
  try {
    const sid = namespace + ':' + identifier;
    const hash_id = utils.hash(sid);

    return await tendermint.query('GetIdentityInfo',{
      hash_id,
      node_id,
    });
  } catch (error) {
    throw new CustomError({
      message: 'Cannot get accessor public key from blockchain',
      cause: error,
    });
  }
}

/**
 * Returns false if request is closed or timed out
 * @param {string} requestId
 * @returns {boolean}
 */
export async function shouldRetryCallback(requestId) {
  if (requestId) {
    const requestDetail = await getRequestDetail({ requestId });
    if (requestDetail.closed || requestDetail.timed_out) {
      return false;
    }
  }
  return true;
}