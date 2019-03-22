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

import schemasV3 from './json_schema/v3';
import ndidSchemas from './json_schema/ndid';

const ajvOptions = {
  allErrors: true,
};

const ajv = new Ajv(ajvOptions);

function validate({ ndidApi, apiVersion, method, path, params, query, body }) {
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

  if (ndidApi) {
    ajv.addSchema(ndidSchemas.defsSchema, 'defs');
  } else {
    if (apiVersion === 3) {
      ajv.addSchema(schemasV3.defsSchema, 'defs');
    }
  }

  const jsonSchema = getJSONSchema(ndidApi, apiVersion, method, path, dataType);
  const validate = ajv.compile(jsonSchema);
  const valid = validate(data);

  return {
    valid,
    errors: validate.errors,
  };
}

function getJSONSchema(ndidApi, apiVersion, method, path, dataType) {
  try {
    if (ndidApi) {
      return ndidSchemas[method][path][dataType];
    } else {
      if (apiVersion === 3) {
        return schemasV3[method][path][dataType];
      }
    }
  } catch (error) {
    throw new Error('Cannot find JSON schema for validation');
  }
}

export default validate;
