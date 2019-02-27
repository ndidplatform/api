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

import * as utils from '../utils';
import * as tendermint from '../tendermint';
import logger from '../logger';
import { callbackToClient } from '../utils/callback';

export async function tmQuery({ fnName, jsonParameter }) {
  try {
    return await tendermint.query(fnName, jsonParameter);
  } catch (error) {
    logger.error({
      message: 'Cannot query',
      err: error,
    });
    throw error;
  }
}

export async function tmTransact({
  nodeId,
  fnName,
  jsonParameter,
  callbackUrl,
  useMasterKey,
  sync,
}) {
  try {
    if (sync || !callbackUrl) {
      return JSON.stringify(
        await tendermint.transact({
          nodeId,
          fnName,
          params: jsonParameter,
          useMasterKey,
        })
      );
    }
    tendermint
      .transact({ nodeId, fnName, params: jsonParameter, useMasterKey })
      .then((result) => {
        callbackToClient(callbackUrl, {
          success: true,
          result,
        });
      })
      .catch((error) => {
        callbackToClient(callbackUrl, {
          success: false,
          error,
        });
      });
    return 'Accept';
  } catch (error) {
    logger.error({
      message: 'Cannot create transaction',
      err: error,
    });
    throw error;
  }
}
