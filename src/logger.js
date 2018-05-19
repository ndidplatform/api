import path from 'path';
import util from 'util';
import winston from 'winston';
import 'winston-daily-rotate-file';

import * as config from './config';

const env = process.env.NODE_ENV || 'development';

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
if (env !== 'production') {
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
        filename: path.join(config.LOG_DIRECTORY_PATH, 'error-%DATE%.log'),
        level: 'error',
        // datePattern: 'YYYY-MM-DD',
        zippedArchive: true, // gzip archived log files
      }),
      new winston.transports.DailyRotateFile({
        filename: path.join(config.LOG_DIRECTORY_PATH, 'combined-%DATE%.log'),
        // datePattern: 'YYYY-MM-DD',
        zippedArchive: true, // gzip archived log files
      }),
    ],
    exitOnError: false,
  });
}

export default logger;
