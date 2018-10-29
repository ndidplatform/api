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

import messageTypesObj from './type';
import schemas from './json_schema';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

const ajvOptions = {
  allErrors: true,
};

const ajv = new Ajv(ajvOptions);

const messageTypes = Object.values(messageTypesObj);

function validate({ type, message }) {
  if (messageTypes.indexOf(type) < 0) {
    throw new CustomError({
      errorType: errorType.INVALID_MESSAGE_TYPE,
      details: {
        type,
      },
    });
  }

  try {
    const dataJsonSchema = schemas[type];

    ajv.removeSchema('defs');

    ajv.addSchema(schemas.defsSchema, 'defs');

    const validate = ajv.compile(dataJsonSchema);
    const valid = validate(message);

    return {
      valid,
      errors: validate.errors,
    };
  } catch (error) {
    throw new CustomError({
      errorType: errorType.CANNOT_VALIDATE_MESSAGE,
      cause: error,
    });
  }
}

export default validate;
