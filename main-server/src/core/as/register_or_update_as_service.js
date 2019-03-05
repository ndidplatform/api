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

import { setServiceCallbackUrl } from '.';

import * as tendermintNdid from '../../tendermint/ndid';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import { callbackToClient } from '../../callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

export async function registerOrUpdateASService(
  registerOrUpdateASServiceParams,
  { synchronous = false } = {}
) {
  let { node_id } = registerOrUpdateASServiceParams;
  const {
    service_id,
    reference_id,
    callback_url,
    min_ial,
    min_aal,
    url,
  } = registerOrUpdateASServiceParams;

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
    //check already register?
    let registeredASList = await tendermintNdid.getAsNodesByServiceId({
      service_id,
    });
    let isRegisterd = false;
    registeredASList.forEach((registeredAS) => {
      isRegisterd = isRegisterd || registeredAS.node_id === node_id;
    });

    if (!isRegisterd) {
      if (!service_id || !min_aal || !min_ial || !url) {
        throw new CustomError({
          errorType: errorType.MISSING_ARGUMENTS,
        });
      }
    }

    if (synchronous) {
      await registerOrUpdateASServiceInternalAsync(...arguments, {
        nodeId: node_id,
        isRegisterd,
      });
    } else {
      registerOrUpdateASServiceInternalAsync(...arguments, {
        nodeId: node_id,
        isRegisterd,
      });
    }
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register/update AS service',
      service_id,
      reference_id,
      callback_url,
      min_ial,
      min_aal,
      url,
      synchronous,
      cause: error,
    });
  }
}

async function registerOrUpdateASServiceInternalAsync(
  { service_id, reference_id, callback_url, min_ial, min_aal, url },
  { synchronous = false } = {},
  { nodeId, isRegisterd }
) {
  try {
    if (!isRegisterd) {
      if (!synchronous) {
        await tendermintNdid.registerServiceDestination(
          {
            service_id,
            min_aal,
            min_ial,
          },
          nodeId,
          'as.registerOrUpdateASServiceInternalAsyncAfterBlockchain',
          [
            { nodeId, reference_id, callback_url, service_id, url },
            { synchronous },
          ]
        );
      } else {
        await tendermintNdid.registerServiceDestination(
          {
            service_id,
            min_aal,
            min_ial,
          },
          nodeId
        );
        await registerOrUpdateASServiceInternalAsyncAfterBlockchain(
          {},
          { nodeId, reference_id, callback_url, service_id, url },
          { synchronous }
        );
      }
    } else {
      if (!synchronous) {
        await tendermintNdid.updateServiceDestination(
          {
            service_id,
            min_aal,
            min_ial,
          },
          nodeId,
          'as.registerOrUpdateASServiceInternalAsyncAfterBlockchain',
          [
            { nodeId, reference_id, callback_url, service_id, url },
            { synchronous },
          ]
        );
      } else {
        await tendermintNdid.updateServiceDestination(
          {
            service_id,
            min_aal,
            min_ial,
          },
          nodeId
        );
        await registerOrUpdateASServiceInternalAsyncAfterBlockchain(
          {},
          { nodeId, reference_id, callback_url, service_id, url },
          { synchronous }
        );
      }
    }
  } catch (error) {
    logger.error({
      message: 'Upsert AS service internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'add_or_update_service_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    }

    throw error;
  }
}

export async function registerOrUpdateASServiceInternalAsyncAfterBlockchain(
  { error, chainDisabledRetryLater },
  { nodeId, reference_id, callback_url, service_id, url },
  { synchronous = false } = {}
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    if (url) {
      await setServiceCallbackUrl(nodeId, service_id, url);
    }

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'add_or_update_service_result',
          success: true,
          reference_id,
        },
        retry: true,
      });
    }
  } catch (error) {
    logger.error({
      message: 'Upsert AS service internal async after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      err: error,
    });

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'add_or_update_service_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        retry: true,
      });
    } else {
      throw error;
    }
  }
}
