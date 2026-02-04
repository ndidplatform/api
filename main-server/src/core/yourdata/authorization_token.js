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

// import * as tendermintNdid from '../../tendermint/ndid';

export const USAGE_TYPE = {
  ONE_TIME: 'one_time',
  CONTINUOUS_WITH_EXPIRE: 'continuous_with_expire',
  CONTINUOUS_NO_EXPIRE: 'continuous_no_expire',
};

export async function validateAuthorization({
  parsedAuthorizationTokenPayload: payload,
  rpNodeId,
  asNodeId,
  namespace,
  identifier,
  serviceId,
  serviceExtension,
}) {
  // if "usage_type" is not "continuous_no_expire", check if it is not yet expired using "expiration_datetime"
  if (payload.usage_type !== USAGE_TYPE.CONTINUOUS_NO_EXPIRE) {
    const expirationUnixSeconds = payload.expiration_datetime;
    const expirationUnix = expirationUnixSeconds * 1000;
    if (Date.now() > expirationUnix) {
      // authorization token expired
      throw new CustomError({
        errorType: errorType.TOKEN_EXPIRED,
        details: {
          expiration_datetime: payload.expiration_datetime,
        },
      });
    }
  }

  // check if "rp_node_id" and "as_node_id" in payload match with the ones in the parameter
  if (payload.rp_node_id !== rpNodeId) {
    // mismatch RP node ID
    throw new CustomError({
      errorType: errorType.TOKEN_RP_NODE_ID_MISMATCH,
      details: {
        rp_node_id: payload.rp_node_id,
        requestRpNodeId: rpNodeId,
      },
    });
  }
  if (payload.as_node_id !== asNodeId) {
    // mismatch AS node ID
    throw new CustomError({
      errorType: errorType.TOKEN_AS_NODE_ID_MISMATCH,
      details: {
        as_node_id: payload.as_node_id,
        requestAsNodeId: asNodeId,
      },
    });
  }

  // if "validate_identifier" is true, check if "namespace" and "identifier" in payload match with the ones in the parameter
  if (payload.validate_identifier) {
    if (payload.namespace !== namespace) {
      // mismatch namespace
      throw new CustomError({
        errorType: errorType.TOKEN_NAMESPACE_MISMATCH,
        details: {
          namespace: payload.namespace,
          requestNamespace: namespace,
        },
      });
    }
    if (payload.identifier !== identifier) {
      // mismatch identifier
      throw new CustomError({
        errorType: errorType.TOKEN_IDENTIFIER_MISMATCH,
        details: {
          identifier: payload.identifier,
          requestIdentifier: identifier,
        },
      });
    }
  }

  // if "validate_service_id" is true, check if "service_id" in the parameter exists in "service_id_list" array
  if (payload.validate_service_id) {
    const matchedService = payload.service_id_list.find((service) => {
      if (service.service_id === serviceId) {
        return true;
      }
    });
    if (matchedService == null) {
      // no requested "service_id" in service ID list
      throw new CustomError({
        errorType: errorType.REQUESTED_SERVICE_ID_NOT_FOUND_IN_TOKEN,
        details: {
          requestServiceId: serviceId,
        },
      });
    }

    // if "validate_service_extension" is true, check if "service_extension" in the parameter exists in "service_id_list"."service_extension array
    // "validate_service_extension" can only be true if and only if "validate_service_id" is true
    if (payload.validate_service_extension) {
      const matchedServiceExtension = matchedService.service_extension.find(
        (serviceExt) => {
          if (serviceExt === serviceExtension) {
            return true;
          }
        }
      );
      if (matchedServiceExtension == null) {
        // no requested "service_extension" in service's service extension list
        throw new CustomError({
          errorType: errorType.REQUESTED_SERVICE_EXTENSION_NOT_FOUND_IN_TOKEN,
          details: {
            requestServiceExtension: serviceExtension,
          },
        });
      }
    }
  }

  // "source_request_id_list"
  // only 2 items
  // 1st item = onchain request ID
  // 2nd item = offchain request ID
  // should validate only on AS side before sending to RP

  // -> unable to validate since the data will depend on which step in Yourdata flow is currently at.
  // It involves service ID and must be hardcoded which should be avoided

  // // check source request ID - validate against request ID on blockchain
  // const sourceRequestsExistence = await Promise.all(
  //   payload.source_request_id_list.map(async (sourceRequestId) => {
  //     const sourceRequest = await tendermintNdid.getRequest({
  //       requestId: sourceRequestId,
  //     });
  //     if (sourceRequest != null) {
  //       // TODO: check request is completed and closed
  //       return {
  //         sourceRequestId,
  //         exists: true,
  //       };
  //     }

  //     return {
  //       sourceRequestId,
  //       exists: false,
  //     };
  //   })
  // );

  // for (let i = 0; i < sourceRequestsExistence.length; i++) {
  //   const { sourceRequestId, exists } = sourceRequestsExistence[i];
  //   if (!exists) {
  //     throw new CustomError({
  //       errorType: errorType.UNKNOWN_ERROR, // FIXME
  //       details: {
  //         sourceRequestId,
  //       },
  //     });
  //   }
  // }
}
