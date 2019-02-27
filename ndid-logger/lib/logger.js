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

const pino = require('pino');

/**
 * Initialize logger
 * @param {Object} config
 * @param {string} config.env
 * @param {string} config.name // Remove?
 * @param {string} config.logLevel
 * @param {boolean} config.logPrettyPrint
 * @param {boolean} config.logColor
 * @param {string} config.replaceForTooLongLog // Remove?
 * @param {number} config.logLengthThreshold // Remove?
 * @returns {Object} logger
 */
function initLogger(config) {
  const logger = pino({
    level: config.logLevel,
    messageKey: 'message',
    // base: {
    //   pid: config.logPid ? process.pid : null,
    //   hostname: config.logHostname ? os.hostname : null,
    // },
    prettyPrint: config.logPrettyPrint
      ? { colorize: config.logColor, translateTime: true, errorProps: '*' }
      : undefined,
  });

  return logger;
}

module.exports.initLogger = initLogger;
