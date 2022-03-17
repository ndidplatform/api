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
import addFormats from 'ajv-formats';
import ajvKeywords from 'ajv-keywords';

import schemasV4 from './json_schema/v4';
import schemasV5 from './json_schema/v5';
import ndidSchemas from './json_schema/ndid';
import configSchemas from './json_schema/config';

const ajvOptions = {
  allErrors: true,
};

const ajv = new Ajv(ajvOptions);
addFormats(ajv);
ajvKeywords(ajv, ['uniqueItemProperties']);

function validate({
  configApi,
  ndidApi,
  apiVersion,
  method,
  path,
  params,
  query,
  body,
}) {
  let data;
  let dataType;
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

  ajv.removeSchema('defs');

  if (configApi) {
    //
  } else if (ndidApi) {
    ajv.addSchema(ndidSchemas.defsSchema, 'defs');
  } else {
    if (apiVersion === 4) {
      ajv.addSchema(schemasV4.defsSchema, 'defs');
    }
    if (apiVersion === 5) {
      ajv.addSchema(schemasV5.defsSchema, 'defs');
    }
  }

  const jsonSchema = getJSONSchema({
    configApi,
    ndidApi,
    apiVersion,
    method,
    path,
    dataType,
  });
  const validate = ajv.compile(jsonSchema);
  const valid = validate(data);

  return {
    valid,
    errors: validate.errors,
  };
}

function getJSONSchema({
  configApi,
  ndidApi,
  apiVersion,
  method,
  path,
  dataType,
}) {
  try {
    if (configApi) {
      return configSchemas[method][path][dataType];
    }

    if (ndidApi) {
      return ndidSchemas[method][path][dataType];
    }

    if (apiVersion === 4) {
      return schemasV4[method][path][dataType];
    }
    if (apiVersion === 5) {
      return schemasV5[method][path][dataType];
    }
  } catch (error) {
    throw new Error('Cannot find JSON schema for validation');
  }
}

export default validate;
