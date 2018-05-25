export default class CustomError extends Error {
  constructor({ message, code, clientError, details, cause }) {
    super(message);

    Object.defineProperty(this, 'name', {
      value: 'CustomError',
    });

    if (code != null) {
      this.code = code;
    }
    if (details != null) {
      this.details = details;
    }
    if (clientError != null) {
      this.clientError = clientError;
    }

    if (cause != null) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        writable: false,
      });
    }

    Error.captureStackTrace(this, this.constructor);
    const oldStackDescriptor = Object.getOwnPropertyDescriptor(this, 'stack');
    const stackDescriptor = buildStackDescriptor(oldStackDescriptor, cause);
    Object.defineProperty(this, 'stack', stackDescriptor);
  }

  /**
   * Get top of the stack error code
   * @returns {number} Error code
   */
  getCode() {
    if (this.code != null) {
      return this.code;
    }
    if (this.cause != null) {
      return this.cause.getCode();
    }
  }

  getMessageWithCode() {
    if (this.code != null) {
      return this.message;
    }
    if (this.cause != null) {
      return this.cause.getMessageWithCode();
    }
  }

  getMessageWithRootCause() {
    return this.code != null
      ? this.message
      : this.message + '; Caused by: ' + this.getMessageWithCode();
  }

  isRootCauseClientError() {
    if (this.clientError != null) {
      return this.clientError;
    }
    if (this.cause != null) {
      return this.cause.isRootCauseClientError();
    }
    return false;
  }

  /**
   * Get error info
   * @returns {Object} Error info
   */
  getInfoForLog() {
    if (this.details != null) {
      return {
        message: this.message,
        code: this.getCode(),
        details: this.details,
        stack: this.stack,
      };
    } else {
      return {
        message: this.message,
        code: this.getCode(),
        stack: this.stack,
      };
    }
  }
}

function buildStackDescriptor(oldStackDescriptor, nested) {
  if (oldStackDescriptor.get) {
    return {
      get: function() {
        const stack = oldStackDescriptor.get.call(this);
        return buildCombinedStacks(stack, this.nested);
      },
    };
  } else {
    const stack = oldStackDescriptor.value;
    return {
      value: buildCombinedStacks(stack, nested),
    };
  }
}

function buildCombinedStacks(stack, nested) {
  if (nested) {
    stack += '\nCaused By: ' + nested.stack;
  }
  return stack;
}
