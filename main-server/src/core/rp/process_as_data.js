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
import * as common from '../common';
import * as cacheDb from '../../db/cache';
import * as utils from '../../utils';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../../logger';
import PMSLogger, { REQUEST_EVENTS } from '../../pms';

export async function processAsResponse({
  nodeId,
  requestId,
  serviceId,
  asNodeId,
  signature,
  dataSalt,
  data,
  errorCode,
}) {
  logger.debug({
    message: 'Processing AS data response',
    nodeId,
    requestId,
    serviceId,
    asNodeId,
    signature,
    dataSalt,
    data,
    errorCode,
  });

  const asResponseId =
    nodeId + ':' + requestId + ':' + serviceId + ':' + asNodeId;

  if (errorCode != null) {
    cleanUpDataResponseFromAS(nodeId, asResponseId);
    return;
  }

  // log request event: RP_RECEIVES_DATA
  PMSLogger.logRequestEvent(requestId, nodeId, REQUEST_EVENTS.RP_RECEIVES_DATA);

  const signatureFromBlockchain = await tendermintNdid.getDataSignature({
    request_id: requestId,
    service_id: serviceId,
    node_id: asNodeId,
  });

  if (signatureFromBlockchain == null) {
    cleanUpDataResponseFromAS(nodeId, asResponseId);
    return;
  }
  if (
    signature !== signatureFromBlockchain ||
    !(await isDataSignatureValid(
      asNodeId,
      signatureFromBlockchain,
      dataSalt,
      data
    ))
  ) {
    cleanUpDataResponseFromAS(nodeId, asResponseId);
    const err = new CustomError({
      errorType: errorType.INVALID_DATA_RESPONSE_SIGNATURE,
      details: {
        requestId,
      },
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'rp.getErrorCallbackUrl',
      action: 'processAsResponse',
      error: err,
      requestId,
    });
    return;
  }

  try {
    // log request event: RP_ACCEPTS_DATA
    PMSLogger.logRequestEvent(requestId, nodeId, REQUEST_EVENTS.RP_ACCEPTS_DATA);

    await tendermintNdid.setDataReceived(
      {
        requestId,
        service_id: serviceId,
        as_id: asNodeId,
      },
      nodeId,
      'rp.processAsDataAfterSetDataReceived',
      [
        {
          nodeId,
          requestId,
          asNodeId,
          serviceId,
          signature,
          dataSalt,
          data,
          asResponseId,
        },
      ],
      true
    );
  } catch (error) {
    cleanUpDataResponseFromAS(nodeId, asResponseId);
    const err = new CustomError({
      message: 'Cannot set data received',
      details: {
        requestId,
        serviceId,
        asNodeId,
      },
      cause: error,
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'rp.getErrorCallbackUrl',
      action: 'processAsResponse',
      error: err,
      requestId,
    });
  }
}

export async function processAsDataAfterSetDataReceived(
  { error, chainDisabledRetryLater },
  {
    nodeId,
    requestId,
    asNodeId,
    serviceId,
    signature,
    dataSalt,
    data,
    asResponseId,
  }
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    await cacheDb.addDataFromAS(nodeId, requestId, {
      source_node_id: asNodeId,
      service_id: serviceId,
      source_signature: signature,
      signature_sign_method: 'RSA-SHA256',
      data_salt: dataSalt,
      data,
    });

    cleanUpDataResponseFromAS(nodeId, asResponseId);
  } catch (error) {
    const err = new CustomError({
      message: 'Process AS data after set data received to blockchain error',
      details: {
        tendermintResult: arguments[0],
        additionalArgs: arguments[1],
      },
      cause: error,
    });
    logger.error({ err });
    await common.notifyError({
      nodeId,
      getCallbackUrlFnName: 'rp.getErrorCallbackUrl',
      action: 'processAsDataAfterSetDataReceived',
      error: err,
      requestId,
    });
  }
}

async function cleanUpDataResponseFromAS(nodeId, asResponseId) {
  try {
    await cacheDb.removeDataResponseFromAS(nodeId, asResponseId);
  } catch (error) {
    logger.error({
      message: 'Cannot remove data response from AS',
      err: error,
    });
  }
}

async function isDataSignatureValid(asNodeId, signature, salt, data) {
  const public_key = await tendermintNdid.getNodePubKey(asNodeId);
  if (public_key == null) return;

  logger.debug({
    message: 'Verifying AS data signature',
    asNodeId,
    asNodePublicKey: public_key,
    signature,
    salt,
    data,
  });
  if (!utils.verifySignature(signature, public_key, data + salt)) {
    logger.warn({
      message: 'Data signature from AS is not valid',
      signature,
      asNodeId,
      asNodePublicKey: public_key,
    });
    return false;
  }
  return true;
}
