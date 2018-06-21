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

import * as config from './config';

const logFormatForFile = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const customFormat = winston.format.printf((info) => {
  const {
    // timestamp,
    level,
    message,
    [Symbol.for('level')]: _level,
    [Symbol.for('message')]: _message,
    ...rest
  } = info;
  const messageToDisplay =
    typeof message === 'object'
      ? util.inspect(message, {
          depth: null,
          colors: true,
        })
      : message;
  if (Object.keys(rest).length === 0) {
    return `${level}: ${messageToDisplay}`;
  } else {
    return `${level}: ${messageToDisplay} ${util.inspect(rest, {
      depth: null,
      colors: true,
    })}`;
  }
});

const logger = winston.createLogger();

// If we're not in production then log to the `console`
if (config.env !== 'production') {
  logger.configure({
    level: 'debug',
    format: winston.format.combine(
      winston.format.colorize(),
      // winston.format.timestamp(),
      customFormat
    ),
    transports: [new winston.transports.Console()],
    exitOnError: false,
  });
} else {
  logger.configure({
    level: 'info',
    format: logFormatForFile,
    transports: [
      // new winston.transports.File({
      //   filename: 'error.log',
      //   level: 'error',
      // }),
      // new winston.transports.File({
      //   filename: 'combined.log',
      // }),
      new winston.transports.DailyRotateFile({
        filename: path.join(config.logDirectoryPath, 'error-%DATE%.log'),
        level: 'error',
        // datePattern: 'YYYY-MM-DD',
        zippedArchive: true, // gzip archived log files
      }),
      new winston.transports.DailyRotateFile({
        filename: path.join(config.logDirectoryPath, 'combined-%DATE%.log'),
        // datePattern: 'YYYY-MM-DD',
        zippedArchive: true, // gzip archived log files
      }),
    ],
    exitOnError: false,
  });
}

export default logger;
