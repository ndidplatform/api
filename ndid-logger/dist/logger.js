"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.initLogger = initLogger;

var _toPropertyKey2 = _interopRequireDefault(require("@babel/runtime/helpers/toPropertyKey"));

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread"));

var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));

var _path = _interopRequireDefault(require("path"));

var _util = _interopRequireDefault(require("util"));

var _winston = _interopRequireDefault(require("winston"));

require("winston-daily-rotate-file");

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
const removePrintErrStackProp = _winston.default.format(info => {
  if (info._printErrStack != null) {
    const {
      _printErrStack
    } = info,
          rest = (0, _objectWithoutProperties2.default)(info, ["_printErrStack"]); // eslint-disable-line no-unused-vars

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
    utilInspectOptionsOneline
  } = options;

  if (typeof logMessage !== 'object') {
    return logMessage.toString().length > logLengthThreshold ? replaceForTooLongLog : logMessage;
  }

  const display = _util.default.inspect(logMessage, logOneLine ? utilInspectOptionsOneline : utilInspectOptions);

  if (display.length <= logLengthThreshold) {
    return depth === 0 ? display : logMessage;
  }

  const clone = JSON.parse(JSON.stringify(logMessage));

  for (let key in clone) {
    clone[key] = filterTooLongMessage(clone[key], depth + 1, options);
  }

  if (depth === 0) return _util.default.inspect(clone, logOneLine ? utilInspectOptionsOneline : utilInspectOptions);
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


function initLogger(config) {
  const utilInspectOptions = {
    depth: null,
    colors: config.logColor
  };
  const utilInspectOptionsOneline = (0, _objectSpread2.default)({}, utilInspectOptions, {
    breakLength: Infinity
  });

  const customFormat = _winston.default.format.printf(info => {
    const _Symbol$for = Symbol.for('level'),
          _Symbol$for2 = Symbol.for('message'),
          _Symbol$for3 = Symbol.for('splat'),
          {
      timestamp,
      level,
      message,
      [_Symbol$for]: _level,
      // eslint-disable-line no-unused-vars
      [_Symbol$for2]: _message,
      // eslint-disable-line no-unused-vars
      [_Symbol$for3]: _splat
    } = info,
          rest = (0, _objectWithoutProperties2.default)(info, ["timestamp", "level", "message", _Symbol$for, _Symbol$for2, _Symbol$for3].map(_toPropertyKey2.default));

    const timestampStr = timestamp != null ? `${timestamp} ` : '';
    const messageToDisplay = typeof message === 'object' ? _util.default.inspect(message, utilInspectOptions) : message;

    if (Object.keys(rest).length === 0) {
      return `${timestampStr}${level}: ${messageToDisplay}`;
    } else {
      if (rest._printErrStack) {
        if (config.logOneLine) {
          const {
            _printErrStack
          } = rest,
                restWithoutStack = (0, _objectWithoutProperties2.default)(rest, ["_printErrStack"]); // eslint-disable-line no-unused-vars

          return `${timestampStr}${level}: ${messageToDisplay} ${_util.default.inspect(restWithoutStack, utilInspectOptionsOneline)}`;
        } else {
          const {
            _printErrStack,
            stack
          } = rest,
                restWithoutStack = (0, _objectWithoutProperties2.default)(rest, ["_printErrStack", "stack"]); // eslint-disable-line no-unused-vars

          return `${timestampStr}${level}: ${messageToDisplay} ${_util.default.inspect(restWithoutStack, utilInspectOptions)}\n${stack}`;
        }
      } else {
        return `${timestampStr}${level}: ${messageToDisplay} ${filterTooLongMessage(rest, undefined, {
          logLengthThreshold: config.logLengthThreshold != null ? config.logLengthThreshold : Infinity,
          replaceForTooLongLog: config.replaceForTooLongLog != null ? config.replaceForTooLongLog : '<--- Too long, omitted --->',
          logOneLine: config.logOneLine,
          utilInspectOptions,
          utilInspectOptionsOneline
        })}`;
      }
    }
  });

  const combinedFormat = [];

  if (config.logColor) {
    combinedFormat.push(_winston.default.format.colorize());
  }

  if (config.logTarget === 'file') {
    combinedFormat.push(_winston.default.format.timestamp());
  }

  combinedFormat.push(customFormat);

  const defaultLogFormat = _winston.default.format.combine(...combinedFormat);

  const jsonLogFormat = _winston.default.format.combine(removePrintErrStackProp(), _winston.default.format.timestamp(), _winston.default.format.json());

  let logFormat;

  if (config.logFormat === 'json') {
    logFormat = jsonLogFormat;
  } else {
    logFormat = defaultLogFormat;
  }

  const logger = _winston.default.createLogger();

  if (config.logTarget === 'file') {
    logger.configure({
      level: config.logLevel,
      format: logFormat,
      transports: [// new winston.transports.File({
      //   filename: 'error.log',
      //   level: 'error',
      // }),
      // new winston.transports.File({
      //   filename: 'combined.log',
      // }),
      new _winston.default.transports.DailyRotateFile({
        filename: _path.default.join(config.logDirectoryPath, `${process.pid}-error-${config.name}-%DATE%.log`),
        level: 'error',
        // datePattern: 'YYYY-MM-DD',
        zippedArchive: true // gzip archived log files

      }), new _winston.default.transports.DailyRotateFile({
        filename: _path.default.join(config.logDirectoryPath, `${process.pid}-combined-${config.name}-%DATE%.log`),
        // datePattern: 'YYYY-MM-DD',
        zippedArchive: true // gzip archived log files

      })],
      exitOnError: false
    });
  } else {
    logger.configure({
      level: config.logLevel,
      format: logFormat,
      transports: [new _winston.default.transports.Console()],
      exitOnError: false
    });
  }

  return logger;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sb2dnZXIuanMiXSwibmFtZXMiOlsicmVtb3ZlUHJpbnRFcnJTdGFja1Byb3AiLCJ3aW5zdG9uIiwiZm9ybWF0IiwiaW5mbyIsIl9wcmludEVyclN0YWNrIiwicmVzdCIsImZpbHRlclRvb0xvbmdNZXNzYWdlIiwibG9nTWVzc2FnZSIsImRlcHRoIiwib3B0aW9ucyIsImxvZ0xlbmd0aFRocmVzaG9sZCIsInJlcGxhY2VGb3JUb29Mb25nTG9nIiwibG9nT25lTGluZSIsInV0aWxJbnNwZWN0T3B0aW9ucyIsInV0aWxJbnNwZWN0T3B0aW9uc09uZWxpbmUiLCJ0b1N0cmluZyIsImxlbmd0aCIsImRpc3BsYXkiLCJ1dGlsIiwiaW5zcGVjdCIsImNsb25lIiwiSlNPTiIsInBhcnNlIiwic3RyaW5naWZ5Iiwia2V5IiwiaW5pdExvZ2dlciIsImNvbmZpZyIsImNvbG9ycyIsImxvZ0NvbG9yIiwiYnJlYWtMZW5ndGgiLCJJbmZpbml0eSIsImN1c3RvbUZvcm1hdCIsInByaW50ZiIsIlN5bWJvbCIsImZvciIsInRpbWVzdGFtcCIsImxldmVsIiwibWVzc2FnZSIsIl9sZXZlbCIsIl9tZXNzYWdlIiwiX3NwbGF0IiwidGltZXN0YW1wU3RyIiwibWVzc2FnZVRvRGlzcGxheSIsIk9iamVjdCIsImtleXMiLCJyZXN0V2l0aG91dFN0YWNrIiwic3RhY2siLCJ1bmRlZmluZWQiLCJjb21iaW5lZEZvcm1hdCIsInB1c2giLCJjb2xvcml6ZSIsImxvZ1RhcmdldCIsImRlZmF1bHRMb2dGb3JtYXQiLCJjb21iaW5lIiwianNvbkxvZ0Zvcm1hdCIsImpzb24iLCJsb2dGb3JtYXQiLCJsb2dnZXIiLCJjcmVhdGVMb2dnZXIiLCJjb25maWd1cmUiLCJsb2dMZXZlbCIsInRyYW5zcG9ydHMiLCJEYWlseVJvdGF0ZUZpbGUiLCJmaWxlbmFtZSIsInBhdGgiLCJqb2luIiwibG9nRGlyZWN0b3J5UGF0aCIsInByb2Nlc3MiLCJwaWQiLCJuYW1lIiwiemlwcGVkQXJjaGl2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QkUsS0FBakI7QUErQkQsR0FoQ0QsTUFnQ087QUFDTGQsSUFBQUEsTUFBTSxDQUFDRSxTQUFQLENBQWlCO0FBQ2Z2QixNQUFBQSxLQUFLLEVBQUVWLE1BQU0sQ0FBQ2tDLFFBREM7QUFFZjFELE1BQUFBLE1BQU0sRUFBRXNELFNBRk87QUFHZkssTUFBQUEsVUFBVSxFQUFFLENBQUMsSUFBSTVELGlCQUFRNEQsVUFBUixDQUFtQlcsT0FBdkIsRUFBRCxDQUhHO0FBSWZELE1BQUFBLFdBQVcsRUFBRTtBQUpFLEtBQWpCO0FBTUQ7O0FBRUQsU0FBT2QsTUFBUDtBQUNEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTgsIDIwMTkgTmF0aW9uYWwgRGlnaXRhbCBJRCBDT01QQU5ZIExJTUlURURcbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiBORElEIHNvZnR3YXJlLlxuICpcbiAqIE5ESUQgaXMgdGhlIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgdW5kZXJcbiAqIHRoZSB0ZXJtcyBvZiB0aGUgQWZmZXJvIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGVcbiAqIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbiwgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyXG4gKiB2ZXJzaW9uLlxuICpcbiAqIE5ESUQgaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcbiAqIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG4gKiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEFmZmVybyBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEFmZmVybyBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuICogYWxvbmcgd2l0aCB0aGUgTkRJRCBzb3VyY2UgY29kZS4gSWYgbm90LCBzZWUgaHR0cHM6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9hZ3BsLnR4dC5cbiAqXG4gKiBQbGVhc2UgY29udGFjdCBpbmZvQG5kaWQuY28udGggZm9yIGFueSBmdXJ0aGVyIHF1ZXN0aW9uc1xuICpcbiAqL1xuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB1dGlsIGZyb20gJ3V0aWwnO1xuaW1wb3J0IHdpbnN0b24gZnJvbSAnd2luc3Rvbic7XG5pbXBvcnQgJ3dpbnN0b24tZGFpbHktcm90YXRlLWZpbGUnO1xuXG5jb25zdCByZW1vdmVQcmludEVyclN0YWNrUHJvcCA9IHdpbnN0b24uZm9ybWF0KChpbmZvKSA9PiB7XG4gIGlmIChpbmZvLl9wcmludEVyclN0YWNrICE9IG51bGwpIHtcbiAgICBjb25zdCB7IF9wcmludEVyclN0YWNrLCAuLi5yZXN0IH0gPSBpbmZvOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgcmV0dXJuIHJlc3Q7XG4gIH1cbiAgcmV0dXJuIGluZm87XG59KTtcblxuZnVuY3Rpb24gZmlsdGVyVG9vTG9uZ01lc3NhZ2UobG9nTWVzc2FnZSwgZGVwdGggPSAwLCBvcHRpb25zKSB7XG4gIGNvbnN0IHtcbiAgICBsb2dMZW5ndGhUaHJlc2hvbGQsXG4gICAgcmVwbGFjZUZvclRvb0xvbmdMb2csXG4gICAgbG9nT25lTGluZSxcbiAgICB1dGlsSW5zcGVjdE9wdGlvbnMsXG4gICAgdXRpbEluc3BlY3RPcHRpb25zT25lbGluZSxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgaWYgKHR5cGVvZiBsb2dNZXNzYWdlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBsb2dNZXNzYWdlLnRvU3RyaW5nKCkubGVuZ3RoID4gbG9nTGVuZ3RoVGhyZXNob2xkXG4gICAgICA/IHJlcGxhY2VGb3JUb29Mb25nTG9nXG4gICAgICA6IGxvZ01lc3NhZ2U7XG4gIH1cblxuICBjb25zdCBkaXNwbGF5ID0gdXRpbC5pbnNwZWN0KFxuICAgIGxvZ01lc3NhZ2UsXG4gICAgbG9nT25lTGluZSA/IHV0aWxJbnNwZWN0T3B0aW9uc09uZWxpbmUgOiB1dGlsSW5zcGVjdE9wdGlvbnNcbiAgKTtcbiAgaWYgKGRpc3BsYXkubGVuZ3RoIDw9IGxvZ0xlbmd0aFRocmVzaG9sZCkge1xuICAgIHJldHVybiBkZXB0aCA9PT0gMCA/IGRpc3BsYXkgOiBsb2dNZXNzYWdlO1xuICB9XG4gIGNvbnN0IGNsb25lID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShsb2dNZXNzYWdlKSk7XG4gIGZvciAobGV0IGtleSBpbiBjbG9uZSkge1xuICAgIGNsb25lW2tleV0gPSBmaWx0ZXJUb29Mb25nTWVzc2FnZShjbG9uZVtrZXldLCBkZXB0aCArIDEsIG9wdGlvbnMpO1xuICB9XG4gIGlmIChkZXB0aCA9PT0gMClcbiAgICByZXR1cm4gdXRpbC5pbnNwZWN0KFxuICAgICAgY2xvbmUsXG4gICAgICBsb2dPbmVMaW5lID8gdXRpbEluc3BlY3RPcHRpb25zT25lbGluZSA6IHV0aWxJbnNwZWN0T3B0aW9uc1xuICAgICk7XG4gIHJldHVybiBjbG9uZTtcbn1cblxuLyoqXG4gKiBJbml0aWFsaXplIGxvZ2dlclxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZ1xuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5uYW1lXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlnLmxvZ0xldmVsXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlnLmxvZ1RhcmdldFxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5sb2dEaXJlY3RvcnlQYXRoXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlnLmxvZ0Zvcm1hdFxuICogQHBhcmFtIHtib29sZWFufSBjb25maWcubG9nQ29sb3JcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gY29uZmlnLmxvZ09uZUxpbmVcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb25maWcucmVwbGFjZUZvclRvb0xvbmdMb2dcbiAqIEBwYXJhbSB7bnVtYmVyfSBjb25maWcubG9nTGVuZ3RoVGhyZXNob2xkXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBsb2dnZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluaXRMb2dnZXIoY29uZmlnKSB7XG4gIGNvbnN0IHV0aWxJbnNwZWN0T3B0aW9ucyA9IHtcbiAgICBkZXB0aDogbnVsbCxcbiAgICBjb2xvcnM6IGNvbmZpZy5sb2dDb2xvcixcbiAgfTtcbiAgY29uc3QgdXRpbEluc3BlY3RPcHRpb25zT25lbGluZSA9IHtcbiAgICAuLi51dGlsSW5zcGVjdE9wdGlvbnMsXG4gICAgYnJlYWtMZW5ndGg6IEluZmluaXR5LFxuICB9O1xuXG4gIGNvbnN0IGN1c3RvbUZvcm1hdCA9IHdpbnN0b24uZm9ybWF0LnByaW50ZigoaW5mbykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgIHRpbWVzdGFtcCxcbiAgICAgIGxldmVsLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIFtTeW1ib2wuZm9yKCdsZXZlbCcpXTogX2xldmVsLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgICBbU3ltYm9sLmZvcignbWVzc2FnZScpXTogX21lc3NhZ2UsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgIFtTeW1ib2wuZm9yKCdzcGxhdCcpXTogX3NwbGF0LCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgICAuLi5yZXN0XG4gICAgfSA9IGluZm87XG4gICAgY29uc3QgdGltZXN0YW1wU3RyID0gdGltZXN0YW1wICE9IG51bGwgPyBgJHt0aW1lc3RhbXB9IGAgOiAnJztcbiAgICBjb25zdCBtZXNzYWdlVG9EaXNwbGF5ID1cbiAgICAgIHR5cGVvZiBtZXNzYWdlID09PSAnb2JqZWN0J1xuICAgICAgICA/IHV0aWwuaW5zcGVjdChtZXNzYWdlLCB1dGlsSW5zcGVjdE9wdGlvbnMpXG4gICAgICAgIDogbWVzc2FnZTtcbiAgICBpZiAoT2JqZWN0LmtleXMocmVzdCkubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gYCR7dGltZXN0YW1wU3RyfSR7bGV2ZWx9OiAke21lc3NhZ2VUb0Rpc3BsYXl9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJlc3QuX3ByaW50RXJyU3RhY2spIHtcbiAgICAgICAgaWYgKGNvbmZpZy5sb2dPbmVMaW5lKSB7XG4gICAgICAgICAgY29uc3QgeyBfcHJpbnRFcnJTdGFjaywgLi4ucmVzdFdpdGhvdXRTdGFjayB9ID0gcmVzdDsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICAgIHJldHVybiBgJHt0aW1lc3RhbXBTdHJ9JHtsZXZlbH06ICR7bWVzc2FnZVRvRGlzcGxheX0gJHt1dGlsLmluc3BlY3QoXG4gICAgICAgICAgICByZXN0V2l0aG91dFN0YWNrLFxuICAgICAgICAgICAgdXRpbEluc3BlY3RPcHRpb25zT25lbGluZVxuICAgICAgICAgICl9YDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCB7IF9wcmludEVyclN0YWNrLCBzdGFjaywgLi4ucmVzdFdpdGhvdXRTdGFjayB9ID0gcmVzdDsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICAgIHJldHVybiBgJHt0aW1lc3RhbXBTdHJ9JHtsZXZlbH06ICR7bWVzc2FnZVRvRGlzcGxheX0gJHt1dGlsLmluc3BlY3QoXG4gICAgICAgICAgICByZXN0V2l0aG91dFN0YWNrLFxuICAgICAgICAgICAgdXRpbEluc3BlY3RPcHRpb25zXG4gICAgICAgICAgKX1cXG4ke3N0YWNrfWA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBgJHt0aW1lc3RhbXBTdHJ9JHtsZXZlbH06ICR7bWVzc2FnZVRvRGlzcGxheX0gJHtmaWx0ZXJUb29Mb25nTWVzc2FnZShcbiAgICAgICAgICByZXN0LFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsb2dMZW5ndGhUaHJlc2hvbGQ6XG4gICAgICAgICAgICAgIGNvbmZpZy5sb2dMZW5ndGhUaHJlc2hvbGQgIT0gbnVsbFxuICAgICAgICAgICAgICAgID8gY29uZmlnLmxvZ0xlbmd0aFRocmVzaG9sZFxuICAgICAgICAgICAgICAgIDogSW5maW5pdHksXG4gICAgICAgICAgICByZXBsYWNlRm9yVG9vTG9uZ0xvZzpcbiAgICAgICAgICAgICAgY29uZmlnLnJlcGxhY2VGb3JUb29Mb25nTG9nICE9IG51bGxcbiAgICAgICAgICAgICAgICA/IGNvbmZpZy5yZXBsYWNlRm9yVG9vTG9uZ0xvZ1xuICAgICAgICAgICAgICAgIDogJzwtLS0gVG9vIGxvbmcsIG9taXR0ZWQgLS0tPicsXG4gICAgICAgICAgICBsb2dPbmVMaW5lOiBjb25maWcubG9nT25lTGluZSxcbiAgICAgICAgICAgIHV0aWxJbnNwZWN0T3B0aW9ucyxcbiAgICAgICAgICAgIHV0aWxJbnNwZWN0T3B0aW9uc09uZWxpbmUsXG4gICAgICAgICAgfVxuICAgICAgICApfWA7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBjb21iaW5lZEZvcm1hdCA9IFtdO1xuICBpZiAoY29uZmlnLmxvZ0NvbG9yKSB7XG4gICAgY29tYmluZWRGb3JtYXQucHVzaCh3aW5zdG9uLmZvcm1hdC5jb2xvcml6ZSgpKTtcbiAgfVxuICBpZiAoY29uZmlnLmxvZ1RhcmdldCA9PT0gJ2ZpbGUnKSB7XG4gICAgY29tYmluZWRGb3JtYXQucHVzaCh3aW5zdG9uLmZvcm1hdC50aW1lc3RhbXAoKSk7XG4gIH1cbiAgY29tYmluZWRGb3JtYXQucHVzaChjdXN0b21Gb3JtYXQpO1xuICBjb25zdCBkZWZhdWx0TG9nRm9ybWF0ID0gd2luc3Rvbi5mb3JtYXQuY29tYmluZSguLi5jb21iaW5lZEZvcm1hdCk7XG5cbiAgY29uc3QganNvbkxvZ0Zvcm1hdCA9IHdpbnN0b24uZm9ybWF0LmNvbWJpbmUoXG4gICAgcmVtb3ZlUHJpbnRFcnJTdGFja1Byb3AoKSxcbiAgICB3aW5zdG9uLmZvcm1hdC50aW1lc3RhbXAoKSxcbiAgICB3aW5zdG9uLmZvcm1hdC5qc29uKClcbiAgKTtcblxuICBsZXQgbG9nRm9ybWF0O1xuICBpZiAoY29uZmlnLmxvZ0Zvcm1hdCA9PT0gJ2pzb24nKSB7XG4gICAgbG9nRm9ybWF0ID0ganNvbkxvZ0Zvcm1hdDtcbiAgfSBlbHNlIHtcbiAgICBsb2dGb3JtYXQgPSBkZWZhdWx0TG9nRm9ybWF0O1xuICB9XG5cbiAgY29uc3QgbG9nZ2VyID0gd2luc3Rvbi5jcmVhdGVMb2dnZXIoKTtcblxuICBpZiAoY29uZmlnLmxvZ1RhcmdldCA9PT0gJ2ZpbGUnKSB7XG4gICAgbG9nZ2VyLmNvbmZpZ3VyZSh7XG4gICAgICBsZXZlbDogY29uZmlnLmxvZ0xldmVsLFxuICAgICAgZm9ybWF0OiBsb2dGb3JtYXQsXG4gICAgICB0cmFuc3BvcnRzOiBbXG4gICAgICAgIC8vIG5ldyB3aW5zdG9uLnRyYW5zcG9ydHMuRmlsZSh7XG4gICAgICAgIC8vICAgZmlsZW5hbWU6ICdlcnJvci5sb2cnLFxuICAgICAgICAvLyAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAvLyB9KSxcbiAgICAgICAgLy8gbmV3IHdpbnN0b24udHJhbnNwb3J0cy5GaWxlKHtcbiAgICAgICAgLy8gICBmaWxlbmFtZTogJ2NvbWJpbmVkLmxvZycsXG4gICAgICAgIC8vIH0pLFxuICAgICAgICBuZXcgd2luc3Rvbi50cmFuc3BvcnRzLkRhaWx5Um90YXRlRmlsZSh7XG4gICAgICAgICAgZmlsZW5hbWU6IHBhdGguam9pbihcbiAgICAgICAgICAgIGNvbmZpZy5sb2dEaXJlY3RvcnlQYXRoLFxuICAgICAgICAgICAgYCR7cHJvY2Vzcy5waWR9LWVycm9yLSR7Y29uZmlnLm5hbWV9LSVEQVRFJS5sb2dgXG4gICAgICAgICAgKSxcbiAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAvLyBkYXRlUGF0dGVybjogJ1lZWVktTU0tREQnLFxuICAgICAgICAgIHppcHBlZEFyY2hpdmU6IHRydWUsIC8vIGd6aXAgYXJjaGl2ZWQgbG9nIGZpbGVzXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgd2luc3Rvbi50cmFuc3BvcnRzLkRhaWx5Um90YXRlRmlsZSh7XG4gICAgICAgICAgZmlsZW5hbWU6IHBhdGguam9pbihcbiAgICAgICAgICAgIGNvbmZpZy5sb2dEaXJlY3RvcnlQYXRoLFxuICAgICAgICAgICAgYCR7cHJvY2Vzcy5waWR9LWNvbWJpbmVkLSR7Y29uZmlnLm5hbWV9LSVEQVRFJS5sb2dgXG4gICAgICAgICAgKSxcbiAgICAgICAgICAvLyBkYXRlUGF0dGVybjogJ1lZWVktTU0tREQnLFxuICAgICAgICAgIHppcHBlZEFyY2hpdmU6IHRydWUsIC8vIGd6aXAgYXJjaGl2ZWQgbG9nIGZpbGVzXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIGV4aXRPbkVycm9yOiBmYWxzZSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBsb2dnZXIuY29uZmlndXJlKHtcbiAgICAgIGxldmVsOiBjb25maWcubG9nTGV2ZWwsXG4gICAgICBmb3JtYXQ6IGxvZ0Zvcm1hdCxcbiAgICAgIHRyYW5zcG9ydHM6IFtuZXcgd2luc3Rvbi50cmFuc3BvcnRzLkNvbnNvbGUoKV0sXG4gICAgICBleGl0T25FcnJvcjogZmFsc2UsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gbG9nZ2VyO1xufVxuIl19