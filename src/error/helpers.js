import errorType from './type';
import { env } from '../config';

export function getErrorObjectForClient(error) {
  let errorMessage;
  let errorCode;
  let clientError;
  let unauthorizedError;

  if (error.name === 'CustomError') {
    errorMessage = error.getMessageWithCode();
    errorCode = error.getCode();
    clientError = error.isRootCauseClientError();
    if (errorCode === errorType.ABCI_UNAUTHORIZED.code) {
      unauthorizedError = true;
    }
  } else {
    errorMessage = error.message;
    errorCode = error.code != null ? error.code : errorType.UNKNOWN_ERROR.code;
  }

  if (unauthorizedError || clientError === true) {
    return {
      code: errorCode,
      message: errorMessage,
    };
  } else {
    return {
      code: errorCode,
      message: errorMessage,
      stack: env === 'development' ? error.stack : undefined,
    };
  }
}
