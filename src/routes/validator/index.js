import Ajv from 'ajv';

import schemas from './jsonSchemas';

const ajv = new Ajv();

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
    type = 'HTTP path parameters';
  } else if (typeof query === 'object') {
    data = query;
    dataType = 'query';
    type = 'HTTP query string';
  } else if (typeof body === 'object') {
    data = body;
    dataType = 'body';
    type = 'HTTP body';
  }

  const jsonSchema = getJSONSchema(method, path, dataType);
  const validate = ajv.compile(jsonSchema);
  const valid = validate(data);

  return {
    valid,
    type,
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
