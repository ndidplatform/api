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

import domain from '../../domain';

import * as tendermintNdid from '../../../tendermint/ndid';
import * as dataDb from '../../../db/data';

import * as config from '../../../config';
import { role } from '../../../node';

export async function setAutoErrorResponses(params) {
  let { node_id: nodeId } = params;
  const {
    bypass_error_code_check = false,
    unsupported_service,
    service_not_available,
    unsupported_namespace,
    unsupported_authorization,
  } = params;

  if (role === 'proxy') {
    if (nodeId == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    nodeId = config.nodeId;
  }

  let errorCodeList;
  if (!bypass_error_code_check) {
    errorCodeList = await tendermintNdid.getDomainErrorCodeList({
      domain: domain.YOURDATA,
      type: 'as',
    });
  }

  const promises = [];
  if (unsupported_service != null) {
    if (!bypass_error_code_check) {
      if (
        errorCodeList.find(
          (error) => error.error_code === unsupported_service.error_code
        ) == null
      ) {
        throw new CustomError({
          errorType: errorType.INVALID_ERROR_CODE,
          details: {
            as_error_code: unsupported_service.error_code,
          },
        });
      }
    }

    promises.push(
      dataDb.setYourDataASAutoErrorResponseConfig(
        nodeId,
        'unsupported_service',
        {
          error_code: unsupported_service.error_code,
          error_message: unsupported_service.error_message,
        }
      )
    );
  } else if (unsupported_service === null) {
    // null => unset
    promises.push(
      dataDb.removeYourDataASAutoErrorResponseConfig(
        nodeId,
        'unsupported_service'
      )
    );
  }

  if (service_not_available != null) {
    if (!bypass_error_code_check) {
      if (
        errorCodeList.find(
          (error) => error.error_code === service_not_available.error_code
        ) == null
      ) {
        throw new CustomError({
          errorType: errorType.INVALID_ERROR_CODE,
          details: {
            as_error_code: service_not_available.error_code,
          },
        });
      }
    }

    promises.push(
      dataDb.setYourDataASAutoErrorResponseConfig(
        nodeId,
        'service_not_available',
        {
          error_code: service_not_available.error_code,
          error_message: service_not_available.error_message,
        }
      )
    );
  } else if (service_not_available === null) {
    // null => unset
    promises.push(
      dataDb.removeYourDataASAutoErrorResponseConfig(
        nodeId,
        'service_not_available'
      )
    );
  }

  if (unsupported_namespace != null) {
    if (!bypass_error_code_check) {
      if (
        errorCodeList.find(
          (error) => error.error_code === unsupported_namespace.error_code
        ) == null
      ) {
        throw new CustomError({
          errorType: errorType.INVALID_ERROR_CODE,
          details: {
            as_error_code: unsupported_namespace.error_code,
          },
        });
      }
    }

    promises.push(
      dataDb.setYourDataASAutoErrorResponseConfig(
        nodeId,
        'unsupported_namespace',
        {
          error_code: unsupported_namespace.error_code,
          error_message: unsupported_namespace.error_message,
        }
      )
    );
  } else if (unsupported_namespace === null) {
    // null => unset
    promises.push(
      dataDb.removeYourDataASAutoErrorResponseConfig(
        nodeId,
        'unsupported_namespace'
      )
    );
  }

  if (unsupported_authorization != null) {
    if (!bypass_error_code_check) {
      if (
        errorCodeList.find(
          (error) => error.error_code === unsupported_authorization.error_code
        ) == null
      ) {
        throw new CustomError({
          errorType: errorType.INVALID_ERROR_CODE,
          details: {
            as_error_code: unsupported_authorization.error_code,
          },
        });
      }
    }

    promises.push(
      dataDb.setYourDataASAutoErrorResponseConfig(
        nodeId,
        'unsupported_authorization',
        {
          error_code: unsupported_authorization.error_code,
          error_message: unsupported_authorization.error_message,
        }
      )
    );
  } else if (unsupported_authorization === null) {
    // null => unset
    promises.push(
      dataDb.removeYourDataASAutoErrorResponseConfig(
        nodeId,
        'unsupported_authorization'
      )
    );
  }

  await Promise.all(promises);
}

export async function getAutoErrorResponses(params) {
  let { node_id: nodeId } = params;

  if (role === 'proxy') {
    if (nodeId == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    nodeId = config.nodeId;
  }

  const unsupported_service = await dataDb.getYourDataASAutoErrorResponseConfig(
    nodeId,
    'unsupported_service'
  );

  const service_not_available =
    await dataDb.getYourDataASAutoErrorResponseConfig(
      nodeId,
      'service_not_available'
    );

  const unsupported_namespace =
    await dataDb.getYourDataASAutoErrorResponseConfig(
      nodeId,
      'unsupported_namespace'
    );

  const unsupported_authorization =
    await dataDb.getYourDataASAutoErrorResponseConfig(
      nodeId,
      'unsupported_authorization'
    );

  return {
    unsupported_service,
    service_not_available,
    unsupported_namespace,
    unsupported_authorization,
  };
}

export async function getUnsupportedServiceAutoErrorResponseConfig(nodeId) {
  return await dataDb.getYourDataASAutoErrorResponseConfig(
    nodeId,
    'unsupported_service'
  );
}

export async function getServiceNotAvailableAutoErrorResponseConfig(nodeId) {
  return await dataDb.getYourDataASAutoErrorResponseConfig(
    nodeId,
    'service_not_available'
  );
}

export async function getUnsupportedNamespaceAutoErrorResponseConfig(nodeId) {
  return await dataDb.getYourDataASAutoErrorResponseConfig(
    nodeId,
    'unsupported_namespace'
  );
}

export async function getUnsupportedAuthorizationAutoErrorResponseConfig(
  nodeId
) {
  return await dataDb.getYourDataASAutoErrorResponseConfig(
    nodeId,
    'unsupported_authorization'
  );
}
