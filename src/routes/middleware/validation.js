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
  const bodyValidationResult = validate({
    method: req.method,
    path: `${req.baseUrl}${req.route.path}`,
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
