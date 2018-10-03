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

import * as tendermintNdid from '../../tendermint/ndid';
import CustomError from '../../error/custom_error';
import errorType from '../../error/type';

const ajvOptions = {
  allErrors: true,
};

const ajv = new Ajv(ajvOptions);

const dataSchemaCache = {};

async function validate({ serviceId, data }) {
  let dataJson;
  try {
    dataJson = JSON.parse(data);
  } catch (error) {
    throw new CustomError({
      errorType: errorType.CANNOT_PARSE_DATA,
      cause: error,
    });
  }

  let dataSchema, dataSchemaVersion;
  if (dataSchemaCache[serviceId] != null) {
    dataSchema = dataSchemaCache[serviceId].dataSchema;
    dataSchemaVersion = dataSchemaCache[serviceId].dataSchemaVersion;
  } else {
    try {
      const serviceDetail = await tendermintNdid.getServiceDetail(serviceId);
      dataSchema = serviceDetail.data_schema;
      dataSchemaVersion = serviceDetail.data_schema_version;

      dataSchemaCache[serviceId] = { dataSchema, dataSchemaVersion };
    } catch (error) {
      throw new CustomError({
        errorType: errorType.CANNOT_GET_DATA_SCHEMA,
        cause: error,
      });
    }
  }

  if (
    dataSchema == null ||
    dataSchema === 'n/a' ||
    dataSchemaVersion == null ||
    dataSchemaVersion === 'n/a'
  ) {
    return {
      valid: null,
    };
  }

  try {
    const dataJsonSchema = JSON.parse(dataSchema);

    const validate = ajv.compile(dataJsonSchema);
    const valid = validate(dataJson);

    return {
      valid,
      errors: validate.errors,
    };
  } catch (error) {
    throw new CustomError({
      errorType: errorType.CANNOT_VALIDATE_DATA,
      cause: error,
    });
  }
}

export function invalidateDataSchemaCache(serviceId) {
  delete dataSchemaCache[serviceId];
}

export default validate;
