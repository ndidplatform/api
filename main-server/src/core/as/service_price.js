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
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import { getErrorObjectForClient } from '../../utils/error';
import { callbackToClient } from '../../callback';
import logger from '../../logger';

import * as config from '../../config';
import { role } from '../../node';

export async function setServicePrice(
  setServicePriceParams,
  { synchronous = false } = {}
) {
  let { node_id } = setServicePriceParams;
  const { service_id, price_by_currency_list, effective_datetime } =
    setServicePriceParams;

  if (role === 'proxy') {
    if (node_id == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    node_id = config.nodeId;
  }

  for (let i = 0; i < price_by_currency_list.length; i++) {
    const { min_price, max_price } = price_by_currency_list[i];
    if (min_price > max_price) {
      throw new CustomError({
        errorType: errorType.SERVICE_MIN_PRICE_CANNOT_BE_GREATER_THAN_MAX_PRICE,
      });
    }
  }

  try {
    const serviceDetail = await tendermintNdid.getServiceDetail(service_id);
    if (serviceDetail == null) {
      throw new CustomError({
        errorType: errorType.SERVICE_ID_NOT_FOUND,
        details: {
          service_id,
        },
      });
    }

    const servicePriceMinEffectiveDatetimeDelay =
      await tendermintNdid.getServicePriceMinEffectiveDatetimeDelay({
        service_id,
      });

    if (
      new Date(effective_datetime).getTime() <
      new Date().getTime() +
        servicePriceMinEffectiveDatetimeDelay.duration_second * 1000
    ) {
      throw new CustomError({
        errorType: errorType.SERVICE_PRICE_EFFECTIVE_DATETIME_BEFORE_ALLOWED,
      });
    }

    if (synchronous) {
      await setServicePriceInternalAsync(...arguments, {
        nodeId: node_id,
      });
    } else {
      setServicePriceInternalAsync(...arguments, {
        nodeId: node_id,
      });
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot set AS service price',
      cause: error,
      details: {
        service_id,
      },
    });
    logger.error({ err });
    throw err;
  }
}

async function setServicePriceInternalAsync(
  {
    reference_id,
    callback_url,
    service_id,
    price_by_currency_list,
    effective_datetime,
    more_info_url,
    detail,
  },
  { synchronous = false } = {},
  { nodeId }
) {
  // IMPORTANT: bypass effective datetime check on ABCI app since there's an issue with block time drift to the future
  // by causing int64 overflow on time to msec conversion on ABCI side
  // Remove this after the issue with ABCI app is sorted (removing check or else which requires chain migration).
  effective_datetime = new Date(
    new Date(effective_datetime).getTime() + 18446744073710
  );

  try {
    if (!synchronous) {
      await tendermintNdid.setServicePrice(
        {
          service_id,
          price_by_currency_list,
          effective_datetime,
          more_info_url,
          detail,
        },
        nodeId,
        'as.setServicePriceInternalAsyncAfterBlockchain',
        [{ nodeId, reference_id, callback_url }, { synchronous }]
      );
    } else {
      await tendermintNdid.setServicePrice(
        {
          service_id,
          price_by_currency_list,
          effective_datetime,
          more_info_url,
          detail,
        },
        nodeId
      );
      await setServicePriceInternalAsyncAfterBlockchain(
        {},
        { nodeId, reference_id, callback_url },
        { synchronous }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Set AS service price internal async error',
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
          type: 'set_service_price_result',
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

export async function setServicePriceInternalAsyncAfterBlockchain(
  { error, chainDisabledRetryLater },
  { nodeId, reference_id, callback_url },
  { synchronous = false } = {}
) {
  if (chainDisabledRetryLater) return;
  try {
    if (error) throw error;

    if (!synchronous) {
      await callbackToClient({
        callbackUrl: callback_url,
        body: {
          node_id: nodeId,
          type: 'set_service_price_result',
          success: true,
          reference_id,
        },
        retry: true,
      });
    }
  } catch (error) {
    logger.error({
      message: 'Set AS service price internal async after blockchain error',
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
          type: 'set_service_price_result',
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
