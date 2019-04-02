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

import { accessorEncrypt } from '.';

import { getIdentityInfo } from '../identity';
import * as tendermintNdid from '../../tendermint/ndid';
import * as tendermint from '../../tendermint';
import * as cacheDb from '../../db/cache';
import * as mq from '../../mq';
import privateMessageType from '../../mq/message/type';

import { callbackToClient } from '../../callback';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import * as utils from '../../utils';
import { getErrorObjectForClient } from '../../utils/error';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

export async function createResponse(createResponseParams) {
  let { node_id } = createResponseParams;
  const { request_id, ial, aal, accessor_id } = createResponseParams;

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

    const requestData = await cacheDb.getRequestReceivedFromMQ(
      node_id,
      request_id
    );
    if (!requestData) {
      throw new CustomError({
        errorType: errorType.UNKNOWN_CONSENT_REQUEST,
      });
    }

    let accessorPublicKey;
    if (request.mode === 2 || request.mode === 3) {
      //check association mode list
      //idp associate with only mode 2 won't be able to response mode 3 request
      const identityInfo = await getIdentityInfo({
        nodeId: node_id,
        referenceGroupCode: requestData.reference_group_code,
      });
      const { mode_list, ial: declaredIal } = identityInfo;
      if (!mode_list.includes(request.mode)) {
        throw new CustomError({
          errorType: errorType.IDENTITY_MODE_MISMATCH,
        });
      }

      if (accessor_id == null) {
        throw new CustomError({
          errorType: errorType.ACCESSOR_ID_NEEDED,
        });
      }

      accessorPublicKey = await tendermintNdid.getAccessorKey(accessor_id);
      if (accessorPublicKey == null) {
        throw new CustomError({
          errorType: errorType.ACCESSOR_PUBLIC_KEY_NOT_FOUND_OR_NOT_ACTIVE,
          details: {
            accessor_id,
          },
        });
      }

      if (ial !== declaredIal) {
        throw new CustomError({
          errorType: errorType.WRONG_IAL,
        });
      }
    }
    createResponseInternal(createResponseParams, {
      nodeId: node_id,
      requestData,
      accessorPublicKey,
    });
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create IdP response',
      cause: error,
    });
    logger.error({ err });
    throw err;
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
 * @param {string} createResponseParams.accessor_id
 */
export async function createResponseInternal(
  createResponseParams,
  additionalParams = {}
) {
  const {
    reference_id,
    callback_url,
    request_id,
    aal,
    ial,
    status,
    accessor_id,
  } = createResponseParams;
  const { nodeId, requestData, accessorPublicKey } = additionalParams;
  try {
    const request = await tendermintNdid.getRequest({ requestId: request_id });
    const mode = request.mode;

    let signature;
    if (requestData.mode === 1) {
      // get signature for mode 1 - sign with node key
      signature = (await utils.createSignature(
        requestData.request_message,
        nodeId
      )).toString('base64');
    } else if (requestData.mode === 2 || requestData.mode === 3) {
      signature = await accessorEncrypt({
        node_id: nodeId,
        request_message: requestData.request_message,
        initial_salt: requestData.initial_salt,
        accessor_id,
        accessor_public_key: accessorPublicKey,
        reference_id,
        request_id,
      });
    }

    const dataToBlockchain = {
      request_id,
      aal,
      ial,
      status,
      signature,
    };

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
          accessor_id,
          rp_id: requestData.rp_id,
        },
      ],
      true
    );
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create IdP response',
      cause: error,
    });
    logger.error({ err });
    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'response_result',
        success: false,
        reference_id,
        request_id,
        error: getErrorObjectForClient(err),
      },
      retry: true,
    });
  }
}

export async function createResponseAfterBlockchain(
  { height, error, chainDisabledRetryLater },
  { nodeId, reference_id, callback_url, request_id, mode, accessor_id, rp_id }
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    await sendResponseToRP({
      nodeId,
      request_id,
      mode,
      accessor_id,
      rp_id,
      height,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'response_result',
        success: true,
        reference_id,
        request_id,
      },
      retry: true,
    });
  } catch (error) {
    logger.error({
      message: 'Create IdP response after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      err: error,
    });

    await callbackToClient({
      callbackUrl: callback_url,
      body: {
        node_id: nodeId,
        type: 'response_result',
        success: false,
        reference_id: reference_id,
        request_id: request_id,
        error: getErrorObjectForClient(error),
      },
      retry: true,
    });
  }
}

async function sendResponseToRP({
  nodeId,
  request_id,
  mode,
  accessor_id,
  rp_id,
  height,
}) {
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
      accessor_id,
      idp_id: nodeId,
      chain_id: tendermint.chainId,
      height,
    },
    nodeId
  );
}
