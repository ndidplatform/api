import validate from '../validator';
import errorCode from '../../error/code';
import errorMessage from '../../error/message';

// Path params validation (no rules = not needed according to specs)
// export function validatePath(req, res, next) {
//   const paramsValidationResult = validate({
//     method: req.method,
//     path: `${req.baseUrl}${req.route.path}`,
//     params: req.params,
//   });
//   if (!paramsValidationResult.valid) {
//     res.status(400).json({
//       error: {
//         message: errorMessage.PATH_PARAMS_VALIDATION_FAILED,
//         code: errorCode.PATH_PARAMS_VALIDATION_FAILED,
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
    res.status(400).json({
      error: {
        message: errorMessage.QUERY_STRING_VALIDATION_FAILED,
        code: errorCode.QUERY_STRING_VALIDATION_FAILED,
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
    res.status(400).json({
      error: {
        message: errorMessage.BODY_VALIDATION_FAILED,
        code: errorCode.BODY_VALIDATION_FAILED,
        details: bodyValidationResult,
      },
    });
    return;
  }
  next();
}
