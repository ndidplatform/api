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

import { checkAssociated } from '.';

import logger from '../../logger';

import CustomError from '../../error/custom_error';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';

import * as tendermintNdid from '../../tendermint/ndid';
import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';
import * as config from '../../config';

export async function updateIal(
  { reference_id, callback_url, namespace, identifier, ial },
  { synchronous = false } = {}
) {
  try {
    //check onboard
    if (!checkAssociated({ namespace, identifier })) {
      throw new CustomError({
        message: errorType.IDENTITY_NOT_FOUND.message,
        code: errorType.IDENTITY_NOT_FOUND.code,
        clientError: true,
        details: {
          namespace,
          identifier,
        },
      });
    }

    //check max_ial
    ial = parseFloat(ial);
    let { max_ial } = await tendermintNdid.getNodeInfo(config.nodeId);
    if (ial > max_ial) {
      throw new CustomError({
        message: errorType.MAXIMUM_IAL_EXCEED.message,
        code: errorType.MAXIMUM_IAL_EXCEED.code,
        clientError: true,
        details: {
          namespace,
          identifier,
        },
      });
    }

    if (synchronous) {
      await updateIalInternalAsync(...arguments);
    } else {
      updateIalInternalAsync(...arguments);
    }
  } catch (error) {
    const err = new CustomError({
      message: "Cannot update identity's IAL",
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function updateIalInternalAsync(
  { reference_id, callback_url, namespace, identifier, ial },
  { synchronous = false } = {}
) {
  try {
    const hash_id = utils.hash(namespace + ':' + identifier);
    await tendermintNdid.updateIal({ hash_id, ial });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'update_ial_result',
          success: true,
          reference_id,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: "Update identity's IAL internal async error",
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'update_ial_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}
