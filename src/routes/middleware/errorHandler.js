const env = process.env.NODE_ENV || 'development';

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  let errorMessage;
  let errorCode;

  if (err.getMessageWithRootCause != null) {
    errorMessage = err.getMessageWithRootCause();
  } else {
    errorMessage = err.message;
  }

  if (err.code != null) {
    errorCode = err.code;
  } else {
    if (err.getCode != null) {
      errorCode = err.getCode();
    }
  }
  res.status(500).json({
    error: {
      code: errorCode,
      message: errorMessage,
      stack: env === 'development' ? err.stack : undefined,
    },
  });
}
