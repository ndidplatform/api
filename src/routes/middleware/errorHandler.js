const env = process.env.NODE_ENV || 'development';

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  let errorMessage;
  let errorCode;
  let clientError;

  if (err.name === 'CustomError') {
    errorMessage = err.getMessageWithCode();
    errorCode = err.getCode();
    clientError = err.isRootCauseClientError();
  } else {
    errorMessage = err.message;
    errorCode = err.code != null ? err.code : undefined;
  }

  if (clientError === true) {
    res.status(400).json({
      error: {
        code: errorCode,
        message: errorMessage,
      },
    });
  } else {
    res.status(500).json({
      error: {
        code: errorCode,
        message: errorMessage,
        stack: env === 'development' ? err.stack : undefined,
      },
    });
  }
}
