import errorType from '../../error/type';
import { env, clientHttpErrorCode, serverHttpErrorCode } from '../../config';

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  let errorMessage;
  let errorCode;
  let clientError;
  let unauthorizedError;

  if (err.name === 'CustomError') {
    errorMessage = err.getMessageWithCode();
    errorCode = err.getCode();
    clientError = err.isRootCauseClientError();
    if (errorCode === 35001) {
      unauthorizedError = true;
    }
  } else {
    errorMessage = err.message;
    errorCode = err.code != null ? err.code : undefined;
  }

  if (unauthorizedError) {
    res.status(403).json({
      error: {
        code: errorCode,
        message: errorMessage,
      },
    });
  } else if (clientError === true) {
    res.status(clientHttpErrorCode).json({
      error: {
        code: errorCode,
        message: errorMessage,
      },
    });
  } else {
    res.status(serverHttpErrorCode).json({
      error: {
        code: errorCode,
        message: errorMessage,
        stack: env === 'development' ? err.stack : undefined,
      },
    });
  }
}

export function bodyParserErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let errorCode;
  let errorMessage;
  if (err) {
    if (err.type == 'entity.parse.failed') {
      errorCode = errorType.BODY_PARSE_FAILED.code;
      errorMessage = `${errorType.BODY_PARSE_FAILED.message}: ${err.message}`;
    } else {
      errorCode = errorType.BODY_PARSER_ERROR.code;
      errorMessage = `${errorType.BODY_PARSER_ERROR.message}: ${err.message}`;
    }

    if (err.status === 400) {
      res.status(clientHttpErrorCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
        },
      });
    } else {
      res.status(serverHttpErrorCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
          stack: env === 'development' ? err.stack : undefined,
        },
      });
    }
  }
}
