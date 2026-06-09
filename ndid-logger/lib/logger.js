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

const stream = require('node:stream');

const pino = require('pino');
const pinoPretty = require('pino-pretty');

/**
 * Initialize logger
 * @param {Object} config
 * @param {string} config.env
 * @param {string} config.name // Remove?
 * @param {string} config.logLevel
 * @param {boolean} config.logPrettyPrint
 * @param {boolean} config.logColor
 * @param {boolean} config.logOneLine
 * @param {string} config.replaceForTooLongLog // Remove?
 * @param {number} config.logLengthThreshold // Remove?
 * @param {Function} config.optionalErrorLogFn
 * @returns {pino.Logger} logger
 */
function initLogger(config) {
  const oneLinerStream = new stream.Transform({
    transform(chunk, encoding, callback) {
      const chunkStr = chunk.toString();
      this.push(chunkStr.replace(/\r?\n|\r/g, ' ') + '\n');
      callback();
    },
  });
  oneLinerStream.pipe(process.stdout);

  const prettyStream = pinoPretty({
    messageKey: 'message',
    colorize: config.logColor,
    translateTime: 'SYS:standard',
    errorProps: '*',
    // singleLine: config.logOneLine,
    destination: config.logOneLine ? oneLinerStream : process.stdout,
  });

  const optionalErrLogWritable = new stream.Writable({
    objectMode: true,
    writev(chunks, cb) {
      chunks.forEach((item) => {
        const body = item.chunk;
        config.optionalErrorLogFn(body);
      });
      cb();
    },
    write(body, enc, cb) {
      config.optionalErrorLogFn(body);
      cb();
    },
  });

  const streams = [
    config.logPrettyPrint
      ? { level: config.logLevel, stream: prettyStream }
      : { level: config.logLevel, stream: process.stdout },
  ];

  if (typeof config.optionalErrorLogFn === 'function') {
    streams.push({ level: 'error', stream: optionalErrLogWritable });
  }

  const logger = pino(
    {
      messageKey: 'message',
      level: config.logLevel,
      // base: {
      //   pid: config.logPid ? process.pid : null,
      //   hostname: config.logHostname ? os.hostname : null,
      // },
    },
    pino.multistream(streams)
  );

  return logger;
}

module.exports.initLogger = initLogger;
