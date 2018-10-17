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

const errorType = require('./type');

function getErrorObjectForClient(error, includeErrorStack) {
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
      stack: includeErrorStack ? error.stack : undefined,
    };
  }
}

module.exports.getErrorObjectForClient = getErrorObjectForClient;