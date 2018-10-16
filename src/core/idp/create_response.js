/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 *
 * This file is part of NDID software.
 *
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 *
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 *
 * Please contact info@ndid.co.th for any further questions
 *
 */

import * as tendermintNdid from '../../tendermint/ndid';
import * as cacheDb from '../../db/cache';
import * as mq from '../../mq';
import privateMessageType from '../private_message_type';

import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';
import CustomError from '../../error/custom_error';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

export async function requestChallengeAndCreateResponse(createResponseParams) {
  let { node_id } = createResponseParams;
  const {
    request_id,
    ial,
    aal,
    signature,
    secret,
    accessor_id,
  } = createResponseParams;

  if (role === 'proxy') {
    if (node_id == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    node_id = config.nodeId;
  }

  try {
    const request = await tendermintNdid.getRequestDetail({
      requestId: request_id,
    });
    if (request == null) {
      throw new CustomError({
        errorType: errorType.REQUEST_NOT_FOUND,
        details: {
          requestId: request_id,
        },
      });
    }
    if (request.closed) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_CLOSED,
        details: {
          requestId: request_id,
        },
      });
    }
    if (request.timed_out) {
      throw new CustomError({
        errorType: errorType.REQUEST_IS_TIMED_OUT,
        details: {
          requestId: request_id,
        },
      });
    }

    if (ial < request.min_ial) {
      throw new CustomError({
        errorType: errorType.IAL_IS_LESS_THAN_REQUEST_MIN_IAL,
        details: {
          requestId: request_id,
        },
      });
    }
    if (aal < request.min_aal) {
      throw new CustomError({
        errorType: errorType.AAL_IS_LESS_THAN_REQUEST_MIN_AAL,
        details: {
          requestId: request_id,
        },
      });
    }

    const savedRpId = await cacheDb.getRPIdFromRequestId(node_id, request_id);
    if (!savedRpId) {
      throw new CustomError({
        errorType: errorType.UNKNOWN_CONSENT_REQUEST,
      });
    }

    if (request.mode === 3) {
      if (accessor_id == null) {
        throw new CustomError({
          errorType: errorType.ACCESSOR_ID_NEEDED,
        });
      }

      const accessorPublicKey = await tendermintNdid.getAccessorKey(
        accessor_id
      );
      if (accessorPublicKey == null) {
        throw new CustomError({
          errorType: errorType.ACCESSOR_PUBLIC_KEY_NOT_FOUND,
          details: {
            accessor_id,
          },
        });
      }

      // Verify accessor signature
      const { request_message, initial_salt } = await cacheDb.getRequestMessage(
        node_id,
        request_id
      );
      const signatureValid = utils.verifyResponseSignature(
        signature,
        accessorPublicKey,
        request_message,
        initial_salt,
        request_id
      );
      if (!signatureValid) {
        throw new CustomError({
          errorType: errorType.INVALID_ACCESSOR_SIGNATURE,
        });
      }

      if (secret == null) {
        throw new CustomError({
          errorType: errorType.SECRET_NEEDED,
        });
      }

      //check secret
      await utils.extractPaddingFromPrivateEncrypt(secret, accessorPublicKey);

      await cacheDb.setResponseFromRequestId(node_id, request_id, {
        ...createResponseParams,
        node_id,
      });

      const requestData = await cacheDb.getRequestReceivedFromMQ(
        node_id,
        request_id
      );
      const declareIal = (await tendermintNdid.getIdentityInfo(
        requestData.namespace,
        requestData.identifier,
        node_id,
      )).ial;
      if(ial !== declareIal) {
        throw new CustomError({
          errorType: errorType.WRONG_IAL
        });
      }
    }
    requestChallengeAndCreateResponseInternalAsync(
      createResponseParams,
      request,
      node_id
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot request challenge and create IdP response',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

/**
 *
 * @param {Object} createResponseParams
 * @param {Object} request
 * @param {number} request.mode
 * @param {string} request.request_message_hash
 * @param {boolean} request.closed
 * @param {boolean} request.timed_out
 */
async function requestChallengeAndCreateResponseInternalAsync(
  createResponseParams,
  request,
  nodeId
) {
  const {
    reference_id,
    callback_url,
    request_id,
    accessor_id,
  } = createResponseParams;
  try {
    if (request.mode === 3) {
      await requestChallenge({
        nodeId,
        reference_id,
        callback_url,
        request_id,
        accessor_id,
      });
    } else if (request.mode === 1) {
      await createResponse(createResponseParams, { nodeId });
    }
    cacheDb.removeRequestMessage(nodeId, request_id);
  } catch (error) {
    await callbackToClient(
      callback_url,
      {
        node_id: nodeId,
        type: 'response_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(error),
      },
      true
    );
    await cacheDb.removeResponseFromRequestId(request_id);
  }
}

/**
 * Create a (consent) response to a request
 *
 * @param {Object} createResponseParams
 * @param {string} createResponseParams.node_id
 * @param {string} createResponseParams.reference_id
 * @param {string} createResponseParams.callback_url
 * @param {string} createResponseParams.request_id
 * @param {number} createResponseParams.aal
 * @param {number} createResponseParams.ial
 * @param {string} createResponseParams.status
 * @param {string} createResponseParams.signature
 * @param {string} createResponseParams.accessor_id
 * @param {string} createResponseParams.secret
 */
export async function createResponse(
  createResponseParams,
  additionalParams = {}
) {
  try {
    const {
      reference_id,
      callback_url,
      request_id,
      aal,
      ial,
      status,
      signature,
      accessor_id,
      secret,
    } = createResponseParams;
    const { nodeId } = additionalParams;

    const request = await tendermintNdid.getRequest({ requestId: request_id });
    const mode = request.mode;

    let dataToBlockchain, privateProofObject;

    if (mode === 3) {
      let blockchainProofArray = [],
        privateProofValueArray = [],
        samePadding;
      const requestFromMq = await cacheDb.getRequestReceivedFromMQ(
        nodeId,
        request_id
      );

      logger.debug({
        message: 'To generate proof',
        requestFromMq,
      });

      for (let i = 0; i < requestFromMq.challenge.length; i++) {
        let {
          blockchainProof,
          privateProofValue,
          padding,
        } = utils.generateIdentityProof({
          publicKey: await tendermintNdid.getAccessorKey(accessor_id),
          challenge: requestFromMq.challenge[i],
          k: requestFromMq.k[i],
          secret,
        });
        blockchainProofArray.push(blockchainProof);
        privateProofValueArray.push(privateProofValue);
        samePadding = padding;
      }

      privateProofObject = {
        privateProofValueArray,
        accessor_id,
        padding: samePadding,
      };

      dataToBlockchain = {
        request_id,
        aal,
        ial,
        status,
        signature,
        //accessor_id,
        identity_proof: JSON.stringify(blockchainProofArray),
        private_proof_hash: utils.hash(JSON.stringify(privateProofValueArray)),
      };
    } else if (mode === 1) {
      dataToBlockchain = {
        request_id,
        aal,
        ial,
        status,
        signature,
      };
    }

    await Promise.all([
      cacheDb.removeRequestReceivedFromMQ(nodeId, request_id),
      cacheDb.removeResponseFromRequestId(nodeId, request_id),
    ]);

    await tendermintNdid.createIdpResponse(
      dataToBlockchain,
      nodeId,
      'idp.createResponseAfterBlockchain',
      [
        {
          nodeId,
          reference_id,
          callback_url,
          request_id,
          mode,
          privateProofObject,
        },
      ]
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create IdP response',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

export async function createResponseAfterBlockchain(
  { height, error },
  { nodeId, reference_id, callback_url, request_id, mode, privateProofObject }
) {
  try {
    if (error) throw error;

    await sendResponseToRP(
      nodeId,
      request_id,
      mode,
      privateProofObject,
      height
    );

    await callbackToClient(
      callback_url,
      {
        node_id: nodeId,
        type: 'response_result',
        success: true,
        reference_id,
        request_id,
      },
      true
    );
    cacheDb.removeRPIdFromRequestId(nodeId, request_id);
    cacheDb.removeResponseFromRequestId(nodeId, request_id);
  } catch (error) {
    logger.error({
      message: 'Create IdP response after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      error,
    });

    await callbackToClient(
      callback_url,
      {
        node_id: nodeId,
        type: 'response_result',
        success: false,
        reference_id: reference_id,
        request_id: request_id,
        error: getErrorObjectForClient(error),
      },
      true
    );
  }
}

async function requestChallenge({
  nodeId,
  reference_id,
  callback_url,
  request_id,
  accessor_id,
}) {
  //query public key from accessor_id
  const public_key = await tendermintNdid.getAccessorKey(accessor_id);
  //gen public proof
  const [k1, publicProof1] = utils.generatePublicProof(public_key);
  const [k2, publicProof2] = utils.generatePublicProof(public_key);

  //save k to request
  const request = await cacheDb.getRequestReceivedFromMQ(nodeId, request_id);
  if (!request) {
    throw new CustomError({
      errorType: errorType.NO_INCOMING_REQUEST,
      details: {
        request_id,
      },
    });
  }
  request.k = [k1, k2];
  logger.debug({
    message: 'Save K to request',
    request,
  });
  await cacheDb.setRequestReceivedFromMQ(nodeId, request_id, request);
  //declare public proof to blockchain
  await tendermintNdid.declareIdentityProof(
    {
      request_id,
      identity_proof: JSON.stringify([publicProof1, publicProof2]),
    },
    nodeId,
    'idp.requestChallengeAfterBlockchain',
    [
      {
        nodeId,
        reference_id,
        callback_url,
        request_id,
        accessor_id,
        publicProof1,
        publicProof2,
        rp_id: request.rp_id,
      },
    ]
  );
}

export async function requestChallengeAfterBlockchain(
  { height, error },
  {
    nodeId,
    reference_id,
    callback_url,
    request_id,
    accessor_id,
    publicProof1,
    publicProof2,
    rp_id,
  }
) {
  try {
    if (error) throw error;
    //send message queue with public proof

    const nodeInfo = await tendermintNdid.getNodeInfo(rp_id);
    if (nodeInfo == null) {
      throw new CustomError({
        errorType: errorType.NODE_INFO_NOT_FOUND,
        details: {
          request_id,
          accessor_id,
        },
      });
    }

    let receivers;
    if (nodeInfo.proxy != null) {
      if (nodeInfo.proxy.mq == null) {
        throw new CustomError({
          errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
          details: {
            request_id,
            accessor_id,
            nodeId: rp_id,
          },
        });
      }

      receivers = [
        {
          node_id: rp_id,
          public_key: nodeInfo.public_key,
          proxy: {
            node_id: nodeInfo.proxy.node_id,
            public_key: nodeInfo.proxy.public_key,
            ip: nodeInfo.proxy.mq[0].ip,
            port: nodeInfo.proxy.mq[0].port,
            config: nodeInfo.proxy.config,
          },
        },
      ];
    } else {
      if (nodeInfo.mq == null) {
        throw new CustomError({
          errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
          details: {
            request_id,
            accessor_id,
            nodeId: rp_id,
          },
        });
      }

      receivers = [
        {
          node_id: rp_id,
          public_key: nodeInfo.public_key,
          ip: nodeInfo.mq[0].ip,
          port: nodeInfo.mq[0].port,
        },
      ];
    }
    await mq.send(
      receivers,
      {
        type: privateMessageType.CHALLENGE_REQUEST,
        request_id: request_id,
        idp_id: nodeId,
        public_proof: [publicProof1, publicProof2],
        height,
      },
      nodeId
    );
  } catch (error) {
    logger.error({
      message: 'Request challenge after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      error,
    });

    await callbackToClient(
      callback_url,
      {
        node_id: nodeId,
        type: 'response_result',
        success: false,
        reference_id: reference_id,
        request_id: request_id,
        error: getErrorObjectForClient(error),
      },
      true
    );
    await cacheDb.removeResponseFromRequestId(nodeId, request_id);
  }
}

async function sendResponseToRP(
  nodeId,
  request_id,
  mode,
  privateProofObject,
  height
) {
  //mode 1
  if (!privateProofObject) privateProofObject = {};
  const rp_id = await cacheDb.getRPIdFromRequestId(nodeId, request_id);

  logger.info({
    message: 'Query MQ destination for RP',
  });
  logger.debug({
    message: 'Query MQ destination for RP',
    rp_id,
  });

  const nodeInfo = await tendermintNdid.getNodeInfo(rp_id);
  if (nodeInfo == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: {
        request_id,
        privateProofObject,
        height,
      },
    });
  }

  let receivers;
  if (nodeInfo.proxy != null) {
    if (nodeInfo.proxy.mq == null) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id,
          nodeId: rp_id,
        },
      });
    }
    receivers = [
      {
        node_id: rp_id,
        public_key: nodeInfo.public_key,
        proxy: {
          node_id: nodeInfo.proxy.node_id,
          public_key: nodeInfo.proxy.public_key,
          ip: nodeInfo.proxy.mq[0].ip,
          port: nodeInfo.proxy.mq[0].port,
          config: nodeInfo.proxy.config,
        },
      },
    ];
  } else {
    if (nodeInfo.mq == null) {
      throw new CustomError({
        errorType: errorType.MESSAGE_QUEUE_ADDRESS_NOT_FOUND,
        details: {
          request_id,
          nodeId: rp_id,
        },
      });
    }
    receivers = [
      {
        node_id: rp_id,
        public_key: nodeInfo.public_key,
        ip: nodeInfo.mq[0].ip,
        port: nodeInfo.mq[0].port,
      },
    ];
  }
  await mq.send(
    receivers,
    {
      type: privateMessageType.IDP_RESPONSE,
      request_id,
      mode,
      ...privateProofObject,
      height,
      idp_id: nodeId,
    },
    nodeId
  );
}
