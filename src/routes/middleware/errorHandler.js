import logger from '../../logger';
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
    const responseBody = {
      error: {
        code: errorCode,
        message: errorMessage,
      },
    };
    res.status(403).json(responseBody);
    logger.error({
      message: 'Responded Unauthorized with HTTP code 403',
      responseBody,
    });
  } else if (clientError === true) {
    const responseBody = {
      error: {
        code: errorCode,
        message: errorMessage,
      },
    };
    res.status(clientHttpErrorCode).json(responseBody);
    logger.error({
      message: `Responded Bad Request with HTTP code ${clientHttpErrorCode}`,
      responseBody,
    });
  } else {
    const responseBody = {
      error: {
        code: errorCode,
        message: errorMessage,
        stack: env === 'development' ? err.stack : undefined,
      },
    };
    res.status(serverHttpErrorCode).json(responseBody);
    logger.error({
      message: `Responded Internal Server Error with HTTP code ${serverHttpErrorCode}`,
      responseBody,
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
      const responseBody = {
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
      res.status(clientHttpErrorCode).json(responseBody);
      logger.error({
        message: `Responded Bad Request with HTTP code ${clientHttpErrorCode}`,
        responseBody,
      });
    } else {
      const responseBody = {
        error: {
          code: errorCode,
          message: errorMessage,
          stack: env === 'development' ? err.stack : undefined,
        },
      };
      res.status(serverHttpErrorCode).json(responseBody);
      logger.error({
        message: `Responded Internal Server Error with HTTP code ${serverHttpErrorCode}`,
        responseBody,
      });
    }
  }
}
