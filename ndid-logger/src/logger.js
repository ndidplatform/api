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

import path from 'path';
import util from 'util';
import winston from 'winston';
import 'winston-daily-rotate-file';

const removePrintErrStackProp = winston.format((info) => {
  if (info._printErrStack != null) {
    const { _printErrStack, ...rest } = info; // eslint-disable-line no-unused-vars
    return rest;
  }
  return info;
});

function filterTooLongMessage(logMessage, depth = 0, options) {
  const {
    logLengthThreshold,
    replaceForTooLongLog,
    logOneLine,
    utilInspectOptions,
    utilInspectOptionsOneline,
  } = options;

  if (typeof logMessage !== 'object') {
    return logMessage.toString().length > logLengthThreshold
      ? replaceForTooLongLog
      : logMessage;
  }

  const display = util.inspect(
    logMessage,
    logOneLine ? utilInspectOptionsOneline : utilInspectOptions
  );
  if (display.length <= logLengthThreshold) {
    return depth === 0 ? display : logMessage;
  }
  const clone = JSON.parse(JSON.stringify(logMessage));
  for (let key in clone) {
    clone[key] = filterTooLongMessage(clone[key], depth + 1, options);
  }
  if (depth === 0)
    return util.inspect(
      clone,
      logOneLine ? utilInspectOptionsOneline : utilInspectOptions
    );
  return clone;
}

/**
 * Initialize logger
 * @param {Object} config
 * @param {string} config.name
 * @param {string} config.logLevel
 * @param {string} config.logTarget
 * @param {string} config.logDirectoryPath
 * @param {string} config.logFormat
 * @param {boolean} config.logColor
 * @param {boolean} config.logOneLine
 * @param {string} config.replaceForTooLongLog
 * @param {number} config.logLengthThreshold
 * @returns {Object} logger
 */
export function initLogger(config) {
  const utilInspectOptions = {
    depth: null,
    colors: config.logColor,
  };
  const utilInspectOptionsOneline = {
    ...utilInspectOptions,
    breakLength: Infinity,
  };

  const customFormat = winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      [Symbol.for('level')]: _level, // eslint-disable-line no-unused-vars
      [Symbol.for('message')]: _message, // eslint-disable-line no-unused-vars
      [Symbol.for('splat')]: _splat, // eslint-disable-line no-unused-vars
      ...rest
    } = info;
    const timestampStr = timestamp != null ? `${timestamp} ` : '';
    const messageToDisplay =
      typeof message === 'object'
        ? util.inspect(message, utilInspectOptions)
        : message;
    if (Object.keys(rest).length === 0) {
      return `${timestampStr}${level}: ${messageToDisplay}`;
    } else {
      if (rest._printErrStack) {
        if (config.logOneLine) {
          const { _printErrStack, ...restWithoutStack } = rest; // eslint-disable-line no-unused-vars
          return `${timestampStr}${level}: ${messageToDisplay} ${util.inspect(
            restWithoutStack,
            utilInspectOptionsOneline
          )}`;
        } else {
          const { _printErrStack, stack, ...restWithoutStack } = rest; // eslint-disable-line no-unused-vars
          return `${timestampStr}${level}: ${messageToDisplay} ${util.inspect(
            restWithoutStack,
            utilInspectOptions
          )}\n${stack}`;
        }
      } else {
        return `${timestampStr}${level}: ${messageToDisplay} ${filterTooLongMessage(
          rest,
          undefined,
          {
            logLengthThreshold:
              config.logLengthThreshold != null
                ? config.logLengthThreshold
                : Infinity,
            replaceForTooLongLog:
              config.replaceForTooLongLog != null
                ? config.replaceForTooLongLog
                : '<--- Too long, omitted --->',
            logOneLine: config.logOneLine,
            utilInspectOptions,
            utilInspectOptionsOneline,
          }
        )}`;
      }
    }
  });

  const combinedFormat = [];
  if (config.logColor) {
    combinedFormat.push(winston.format.colorize());
  }
  if (config.logTarget === 'file') {
    combinedFormat.push(winston.format.timestamp());
  }
  combinedFormat.push(customFormat);
  const defaultLogFormat = winston.format.combine(...combinedFormat);

  const jsonLogFormat = winston.format.combine(
    removePrintErrStackProp(),
    winston.format.timestamp(),
    winston.format.json()
  );

  let logFormat;
  if (config.logFormat === 'json') {
    logFormat = jsonLogFormat;
  } else {
    logFormat = defaultLogFormat;
  }

  const logger = winston.createLogger();

  if (config.logTarget === 'file') {
    logger.configure({
      level: config.logLevel,
      format: logFormat,
      transports: [
        // new winston.transports.File({
        //   filename: 'error.log',
        //   level: 'error',
        // }),
        // new winston.transports.File({
        //   filename: 'combined.log',
        // }),
        new winston.transports.DailyRotateFile({
          filename: path.join(
            config.logDirectoryPath,
            `${process.pid}-error-${config.name}-%DATE%.log`
          ),
          level: 'error',
          // datePattern: 'YYYY-MM-DD',
          zippedArchive: true, // gzip archived log files
        }),
        new winston.transports.DailyRotateFile({
          filename: path.join(
            config.logDirectoryPath,
            `${process.pid}-combined-${config.name}-%DATE%.log`
          ),
          // datePattern: 'YYYY-MM-DD',
          zippedArchive: true, // gzip archived log files
        }),
      ],
      exitOnError: false,
    });
  } else {
    logger.configure({
      level: config.logLevel,
      format: logFormat,
      transports: [new winston.transports.Console()],
      exitOnError: false,
    });
  }

  return logger;
}
