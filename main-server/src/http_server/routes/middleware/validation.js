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

import validate from '../validator';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

const DEFAULT_API_VERSION = 6;

function getBaseUrlAndApiVersion(req) {
  let baseUrl = req.baseUrl;
  if (baseUrl.startsWith('/config')) {
    return {
      configApi: true,
      baseUrl,
    };
  }
  if (baseUrl.startsWith('/ndid')) {
    return {
      ndidApi: true,
      baseUrl,
    };
  }
  const matchedPath = baseUrl.match(/^\/v([0-9]+)/);
  let apiVersion;
  if (matchedPath != null) {
    const splittedBaseUrl = baseUrl.split('/');
    splittedBaseUrl.splice(1, 1);
    baseUrl = splittedBaseUrl.join('/');
    apiVersion = parseInt(matchedPath[1]);
  } else {
    apiVersion = DEFAULT_API_VERSION;
  }
  return {
    baseUrl,
    apiVersion,
  };
}

// Path params validation (no rules = not needed according to specs)
// export function validatePath(req, res, next) {
//   const { baseUrl, apiVersion } = getBaseUrlAndApiVersion(req);
//   const paramsValidationResult = validate({
//     apiVersion,
//     method: req.method,
//     path: `${baseUrl}${req.route.path}`,
//     params: req.params,
//   });
//   if (!paramsValidationResult.valid) {
//     res.status(clientHttpErrorCode).json({
//       error: {
//         message: errorType.PATH_PARAMS_VALIDATION_FAILED.message,
//         code: errorType.PATH_PARAMS_VALIDATION_FAILED.code,
//         details: paramsValidationResult,
//       },
//     });
//     return;
//   }
// }

export function validateQuery(req, res, next) {
  const { baseUrl, apiVersion } = getBaseUrlAndApiVersion(req);
  const queryValidationResult = validate({
    apiVersion,
    method: req.method,
    path: `${baseUrl}${req.route.path}`,
    query: req.query,
  });
  if (!queryValidationResult.valid) {
    next(
      new CustomError({
        errorType: errorType.QUERY_STRING_VALIDATION_FAILED,
        details: queryValidationResult,
      })
    );
    return;
  }
  next();
}

export function validateBody(req, res, next) {
  const { configApi, ndidApi, baseUrl, apiVersion } = getBaseUrlAndApiVersion(req);
  const bodyValidationResult = validate({
    configApi,
    ndidApi,
    apiVersion,
    method: req.method,
    path: `${baseUrl}${req.route.path}`,
    body: req.body,
  });
  if (!bodyValidationResult.valid) {
    next(
      new CustomError({
        errorType: errorType.BODY_VALIDATION_FAILED,
        details: bodyValidationResult,
      })
    );
    return;
  }
  next();
}
