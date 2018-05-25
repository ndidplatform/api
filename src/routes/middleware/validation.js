import validate from '../validator';
import errorCode from '../../error/code';

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
//         message: 'Invalid input',
//         code: errorCode.INVALID_INPUT,
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
        message: 'Invalid input',
        code: errorCode.INVALID_INPUT,
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
        message: 'Invalid input',
        code: errorCode.INVALID_INPUT,
        details: bodyValidationResult,
      },
    });
    return;
  }
  next();
}
