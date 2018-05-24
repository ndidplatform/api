export default class CustomError extends Error {
  constructor(message, code, details) {
    super(message);

    this.code = code;
    if (details != null) {
      this.details = details;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  getInfoForLog() {
    if (this.details != null) {
      return {
        message: this.message,
        code: this.code,
        details: this.details,
      };
    } else {
      return {
        message: this.message,
        code: this.code,
      };
    }
  }
}
