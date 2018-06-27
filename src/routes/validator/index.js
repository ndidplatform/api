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

import Ajv from 'ajv';

import schemas from './jsonSchemas';

const ajv = new Ajv({
  allErrors: true,
});

ajv.addSchema(schemas.defsSchema, 'defs');

ajv.addFormat(
  'url-with-local-ip',
  '^' +
    // protocol identifier
    '(?:https?://)' +
    // user:pass authentication
    '(?:\\S+(?::\\S*)?@)?' +
    '(?:' +
    // IP address exclusion
    // private & local networks
    // "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
    // "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
    // "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +

    // Allow localhost
    '(?:localhost)' +
    '|' +
    // IP address dotted notation octets
    // excludes loopback network 0.0.0.0
    // excludes reserved space >= 224.0.0.0
    // excludes network & broadcast addresses
    // (first & last IP address of each class)
    '(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' +
    '(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' +
    '(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' +
    '|' +
    // host name
    '(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)' +
    // domain name
    '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*' +
    // TLD identifier
    '(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))' +
    // TLD may end with dot
    '\\.?' +
    ')' +
    // port number
    '(?::\\d{2,5})?' +
    // resource path
    '(?:[/?#]\\S*)?' +
    '$'
);

const validate = ({ method, path, params, query, body }) => {
  let data;
  let dataType;
  let type;
  if (typeof params === 'object') {
    data = params;
    dataType = 'params';
  } else if (typeof query === 'object') {
    data = query;
    dataType = 'query';
  } else if (typeof body === 'object') {
    data = body;
    dataType = 'body';
  }

  const jsonSchema = getJSONSchema(method, path, dataType);
  const validate = ajv.compile(jsonSchema);
  const valid = validate(data);

  return {
    valid,
    errors: validate.errors,
  };
};

const getJSONSchema = (method, path, dataType) => {
  try {
    return schemas[method][path][dataType];
  } catch (error) {
    throw new Error('Cannot find JSON schema for validation');
  }
};

export default validate;
