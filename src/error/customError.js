/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 * 
 * This file is part of NDID software.
 * 
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 * 
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 * 
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 * 
 * Please contact info@ndid.co.th for any further questions
 * 
 */

import type from './type';

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
    if (this.cause != null && this.cause.name === 'CustomError') {
      return this.cause.getCode();
    }
    return type.UNKNOWN_ERROR.code;
  }

  getMessageWithCode() {
    if (this.code != null) {
      return this.message;
    }
    if (this.cause != null && this.cause.name === 'CustomError') {
      return this.cause.getMessageWithCode();
    }
    return this.cause.message;
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
    if (this.cause != null && this.cause.name === 'CustomError') {
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
