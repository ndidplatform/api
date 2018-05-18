import util from 'util';
import winston from 'winston';

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

const logger = winston.createLogger({
  level: env !== 'production' ? 'debug' : 'info',
  exitOnError: false,
});

// If we're not in production then log to the `console` with debug log level
if (env !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        // winston.format.timestamp(),
        customFormat
      ),
    })
  );
} else {
  logger.add(
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: logFormatForFile,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'combined.log',
      format: logFormatForFile,
    })
  );
}

export default logger;
