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
import errorType from '../../error/type';

import { clientHttpErrorCode } from '../../config';

// Path params validation (no rules = not needed according to specs)
// export function validatePath(req, res, next) {
//   const paramsValidationResult = validate({
//     method: req.method,
//     path: `${req.baseUrl}${req.route.path}`,
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
  const queryValidationResult = validate({
    method: req.method,
    path: `${req.baseUrl}${req.route.path}`,
    query: req.query,
  });
  if (!queryValidationResult.valid) {
    res.status(clientHttpErrorCode).json({
      error: {
        message: errorType.QUERY_STRING_VALIDATION_FAILED.message,
        code: errorType.QUERY_STRING_VALIDATION_FAILED.code,
        details: queryValidationResult,
      },
    });
    return;
  }
  next();
}

export function validateBody(req, res, next) {
  let baseUrl = req.baseUrl;
  if (baseUrl.indexOf('/v1') >= 0) {
    const splittedBaseUrl = baseUrl.split('/');
    splittedBaseUrl.splice(1, 1);
    baseUrl = splittedBaseUrl.join('/');
  }
  const bodyValidationResult = validate({
    method: req.method,
    path: `${baseUrl}${req.route.path}`,
    body: req.body,
  });
  if (!bodyValidationResult.valid) {
    res.status(clientHttpErrorCode).json({
      error: {
        message: errorType.BODY_VALIDATION_FAILED.message,
        code: errorType.BODY_VALIDATION_FAILED.code,
        details: bodyValidationResult,
      },
    });
    return;
  }
  next();
}
