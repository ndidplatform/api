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

import schemasV1 from './json_schema/v1';
import schemasV2 from './json_schema/v2';

const ajvOptions = {
  allErrors: true,
};

const ajv = new Ajv(ajvOptions);

const validate = ({ apiVersion, method, path, params, query, body }) => {
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

  if (apiVersion === 1) {
    ajv.addSchema(schemasV1.defsSchema, 'defs');
  } else {
    ajv.addSchema(schemasV2.defsSchema, 'defs');
  }

  const jsonSchema = getJSONSchema(apiVersion, method, path, dataType);
  const validate = ajv.compile(jsonSchema);
  const valid = validate(data);

  return {
    valid,
    errors: validate.errors,
  };
};

const getJSONSchema = (apiVersion, method, path, dataType) => {
  try {
    if (apiVersion === 1) {
      return schemasV1[method][path][dataType];
    } else {
      return schemasV2[method][path][dataType];
    }
  } catch (error) {
    throw new Error('Cannot find JSON schema for validation');
  }
};

export default validate;
