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

import { initLogger } from 'ndid-logger';

import { maskIdentifier, maskUrl } from './utils/masking';

import * as config from './config';

const redactPaths = [
  'req.url',
  'originalUrl',
  // identifier
  'body.identifier',
  'body.identity_list[*].identifier',
  'callbackAdditionalArgs[*].requestData.identifier',
  'messageObject.identifier',
  'messageJSON.identifier',
  'requestData.identifier',
  'request.identifier',
  'callbackAdditionalArgs[*].identity.identifier',
  'callbackAdditionalArgs[*].callbackAdditionalArgs[*].identity.identifier',
  'callbackAdditionalArgs[*].callbackAdditionalArgs[*].identity.identity_list[*].identifier',
  // (Your Data)
  'body.sub_identity_list[*].identifier',
  // (in error log)
  'originalArgs.identifier',
  'additionalArgs.requestData.identifier',
  'options.callbackAdditionalArgs[*].requestData.identifier',
  'options.identity.identifier',
  'additionalArgs.identity.identifier',
  'additionalArgs.new_identity_list[*].identifier',
  'options.identity.new_identity_list[*].identifier',
  'additionalArgs.identity.new_identity_list[*].identifier',
  'err.cause.details.identifier',
  //
  'options.existingIdentifier',
  'err.cause.details.requestIdentifier',
  // request_message
  'body.request_message',
  'callbackAdditionalArgs[*].requestData.request_message',
  'additionalArgs.requestData.request_message',
  'options.callbackAdditionalArgs[*].requestData.request_message',
  'messageObject.request_message',
  'messageJSON.request_message',
  'requestData.request_message',
  'request.request_message',
  // (in error log)
  'originalArgs.request_message',
  // request_params
  'body.request_params',
  'body.data_request_list[*].request_params',
  'callbackAdditionalArgs[*].requestData.data_request_list[*].request_params',
  'additionalArgs.requestData.data_request_list[*].request_params',
  'options.callbackAdditionalArgs[*].requestData.data_request_list[*].request_params',
  'requestData.data_request_list[*].request_params',
  // (in error log)
  'originalArgs.data_request_list[*].request_params',
  'err.cause.details.data_request_list[*].request_params',
  //
  'messageObject.service_data_request_list[*].request_params',
  'messageJSON.service_data_request_list[*].request_params',
  'request.service_data_request_list[*].request_params',
  // (Your Data)
  'messageObject.request_params',
  'messageJSON.request_params',
  // request_params_salt
  'messageObject.service_data_request_list[*].request_params_salt',
  'messageJSON.service_data_request_list[*].request_params_salt',
  'request.service_data_request_list[*].request_params_salt',
  // initial_salt
  'body.initial_salt',
  'callbackAdditionalArgs[*].requestData.initial_salt',
  'callbackAdditionalArgs[*].messageData.initial_salt',
  'additionalArgs.requestData.initial_salt',
  'options.callbackAdditionalArgs[*].requestData.initial_salt',
  'messageObject.initial_salt',
  'messageJSON.initial_salt',
  'requestData.initial_salt',
  'request.initial_salt',
  // request_message_salt
  'body.request_message_salt',
  'callbackAdditionalArgs[*].requestData.request_message_salt',
  'additionalArgs.requestData.request_message_salt',
  'options.callbackAdditionalArgs[*].requestData.request_message_salt',
  'messageObject.request_message_salt',
  'messageJSON.request_message_salt',
  'requestData.request_message_salt',
  'request.request_message_salt',
  // (in error log)
  'additionalArgs.request_message_salt',
  // data_request_params_salt_list
  'callbackAdditionalArgs[*].requestData.data_request_params_salt_list[*]',
  'additionalArgs.requestData.data_request_params_salt_list[*]',
  'options.callbackAdditionalArgs[*].requestData.data_request_params_salt_list[*]',
  'messageObject.data_request_params_salt_list[*]',
  'messageJSON.data_request_params_salt_list[*]',
  'requestData.data_request_params_salt_list[*]',
  // data_salt
  'body.data_salt',
  'callbackAdditionalArgs[*].data_salt',
  'additionalArgs.data_salt',
  'options.callbackAdditionalArgs[*].data_salt',
  'messageObject.data_salt',
  'messageJSON.data_salt',
  'body[*].data_salt',
  //
  'callbackAdditionalArgs[*].messageData.message_salt',
  // packedData.buffer_base64
  'callbackAdditionalArgs[*].packedData.buffer_base64',
  'additionalArgs.packedData.buffer_base64',
  // packed_data.buffer_base64
  'messageObject.packed_data.buffer_base64',
  'messageJSON.packed_data.buffer_base64',
  // data
  'body.data',
  'result.data',
  'body[*].data',
  'callbackAdditionalArgs[*].data',
  // (in error log)
  'data',
  // Your Data
  'body.authorization',
  'messageObject.authorization',
  'messageJSON.authorization',
  //
  'body.token',
  // get private messages response
  'body[*].message.identifier',
  'body[*].message.request_message',
  'body[*].message.request_message_salt',
  'body[*].message.initial_salt',
  'body[*].message.data_request_params_salt_list[*]',
  'body[*].message.service_data_request_list[*].request_params',
  'body[*].message.service_data_request_list[*].request_params_salt',
  'body[*].message.data_salt',
  'body[*].message.packed_data.buffer_base64',
  // (Your Data)
  'body[*].message.request_params',
  'body[*].message.authorization',
];

export const levels = {
  labels: {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  },
};

let optionalErrorLogFn;

export function setOptionalErrorLogFn(fn) {
  optionalErrorLogFn = fn;
}

const logger = initLogger({
  env: config.env,
  name: config.nodeId,
  logLevel: config.logLevel,
  // logPid: config.env !== 'development',
  // logHostname: config.env !== 'development',
  // logTarget: config.logTarget,
  // logDirectoryPath: config.logDirectoryPath,
  // logFormat: config.logFormat,
  logPrettyPrint: config.logPrettyPrint,
  logColor: config.logColor,
  logOneLine: config.logOneLine,
  // replaceForTooLongLog: config.replaceForTooLongLog,
  // logLengthThreshold: config.logLengthThreshold,
  // optionalErrorLogFn: (log) => {
  //   if (optionalErrorLogFn) {
  //     optionalErrorLogFn(log);
  //   }
  // },
});

const REDACT_TEXT = '[REDACTED]';

const maskHandlers = {
  identifier: maskIdentifier,
  existingIdentifier: maskIdentifier,
  requestIdentifier: maskIdentifier,
  originalUrl: maskUrl,
  url: maskUrl,
};

const childRedactedLogger = config.logRedactSensitiveData
  ? logger.child(
      {},
      {
        redact: {
          paths: redactPaths,
          censor: (value, path) => {
            const lastSegment = path[path.length - 1];
            const handler = maskHandlers[lastSegment];

            if (handler) {
              if (lastSegment === 'url' && path[0] !== 'req') {
                return REDACT_TEXT;
              }
              return handler(value);
            }

            return REDACT_TEXT;
          },
        },
      }
    )
  : logger;

const shouldLogTraceWithoutRedact =
  config.logRedactSensitiveData && config.logLevel === 'trace';

export const redactedLogger = {
  error: (...args) => {
    childRedactedLogger.error(...args);
    if (shouldLogTraceWithoutRedact) logger.trace(...args);
  },
  warn: (...args) => {
    childRedactedLogger.warn(...args);
    if (shouldLogTraceWithoutRedact) logger.trace(...args);
  },
  info: (...args) => {
    childRedactedLogger.info(...args);
    if (shouldLogTraceWithoutRedact) logger.trace(...args);
  },
  debug: (...args) => {
    childRedactedLogger.debug(...args);
    if (shouldLogTraceWithoutRedact) logger.trace(...args);
  },
  child: (...args) => childRedactedLogger.child(...args),
};

export default logger;
