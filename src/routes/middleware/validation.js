import validate from '../validator';

// Path params validation (no rules = not needed according to specs)
// export function validatePath(req, res, next) {
//   const paramsValidationResult = validate({
//     method: req.method,
//     path: `${req.baseUrl}${req.route.path}`,
//     params: req.params,
//   });
//   if (!paramsValidationResult.valid) {
//     res.status(400).json(paramsValidationResult);
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
    res.status(400).json(queryValidationResult);
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
    res.status(400).json(bodyValidationResult);
    return;
  }
  next();
}