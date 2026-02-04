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

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import * as tendermintNdid from '../../../tendermint/ndid';
import * as dataDb from '../../../db/data';
import logger from '../../../logger';

import * as config from '../../../config';
import { role } from '../../../node';

export async function registerOrUpdateASService(
  registerOrUpdateASServiceParams
) {
  let { node_id: nodeId } = registerOrUpdateASServiceParams;
  const {
    service_id,
    service_url,
    supported_namespace_list,
    supported_authorization,
    service_availability = true,
  } = registerOrUpdateASServiceParams;

  if (role === 'proxy') {
    if (nodeId == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    nodeId = config.nodeId;
  }

  try {
    if (supported_namespace_list != null) {
      const allowedNamespaces = await tendermintNdid.getNamespaceList();
      supported_namespace_list.forEach((namespace) => {
        if (
          allowedNamespaces.find(
            ({ namespace: allowedNamespace }) => allowedNamespace === namespace
          ) == null
        ) {
          throw new CustomError({
            errorType: errorType.INVALID_NAMESPACE,
            details: {
              namespace,
            },
          });
        }
      });
    }

    // TODO
    // - validate other input params?

    // save service info
    const serviceInfo = {
      service_id,
      service_url,
      supported_namespace_list,
      supported_authorization,
      service_availability,
    };

    await dataDb.setYourDataASService(nodeId, service_id, serviceInfo);

    // TODO: determine
    // what is each parameter use? and
    // when does it get used (besides "service_url")?
    //
  } catch (error) {
    throw new CustomError({
      message: 'Cannot register/update AS YourData service',
      params: registerOrUpdateASServiceParams,
      cause: error,
    });
  }
}
