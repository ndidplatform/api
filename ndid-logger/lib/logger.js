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
const pinoms = require('pino-multi-stream');
const pinoPretty = require('pino-pretty');

function bufferToJSONForLogger() {
  return { type: 'Buffer', data_base64: this.toString('base64') };
}

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
 * @returns {Object} logger
 */
function initLogger(config) {
  const prettyStream = pinoms.prettyStream({
    prettyPrint: {
      messageKey: 'message',
      colorize: config.logColor,
      translateTime: 'SYS:standard',
      errorProps: '*',
    },
    prettifier: (options) => {
      const pretty = pinoPretty(options);
      return (inputData) => {
        const tmp = Buffer.prototype.toJSON;
        Buffer.prototype.toJSON = bufferToJSONForLogger;
        const result = pretty(inputData);
        Buffer.prototype.toJSON = tmp;

        if (config.logOneLine) {
          return result.replace(/\r?\n|\r/g, ' ') + '\n';
        }

        return result;
      };
    },
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

  const logger = pinoms(
    {
      level: config.logLevel,
      // base: {
      //   pid: config.logPid ? process.pid : null,
      //   hostname: config.logHostname ? os.hostname : null,
      // },
      // streams,
    },
    pinoms.multistream(streams)
  );

  return logger;
}

module.exports.initLogger = initLogger;
