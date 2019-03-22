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

import messageTypes from './type';

export default {
  defsSchema: {
    definitions: {
      ial: { type: 'number', enum: [1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3] },
      aal: { type: 'number', enum: [1, 2.1, 2.2, 3] },
    },
  },
  [messageTypes.AS_DATA_RESPONSE]: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    properties: {
      request_id: { type: 'string', minLength: 1 },
      as_id: { type: 'string', minLength: 1 },
      service_id: { type: 'string', minLength: 1 },
      signature: { type: 'string', minLength: 1 },
      data_salt: { type: 'string', minLength: 1 },
      data: { type: 'string', minLength: 1 },
      chain_id: { type: 'string', minLength: 1 },
      height: { type: 'integer', minimum: 1 },
    },
    required: [
      'request_id',
      'as_id',
      'service_id',
      'signature',
      'data_salt',
      'data',
      'chain_id',
      'height',
    ],
  },
  [messageTypes.CONSENT_REQUEST]: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    properties: {
      mode: { type: 'number', enum: [1, 3] },
      namespace: { type: 'string', minLength: 1 },
      identifier: { type: 'string', minLength: 1 },
      request_id: { type: 'string', minLength: 1 },
      min_ial: { $ref: 'defs#/definitions/ial' },
      min_aal: { $ref: 'defs#/definitions/aal' },
      request_timeout: { type: 'integer', minimum: 1 },
      data_request_list: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            service_id: {
              type: 'string',
              minLength: 1,
            },
            as_id_list: {
              type: 'array',
              items: {
                type: 'string',
                minimum: 1,
              },
            },
            min_as: {
              type: 'integer',
              minimum: 1,
            },
          },
          required: ['service_id', 'min_as'],
        },
      },
      data_request_params_salt_list: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1,
        },
      },
      request_message: { type: 'string' },
      rp_id: { type: 'string', minLength: 1 },
      request_message_salt: { type: 'string', minLength: 1 },
      initial_salt: { type: 'string', minLength: 1 },
      creation_time: { type: 'integer', minimum: 1 },
      chain_id: { type: 'string', minLength: 1 },
      height: { type: 'integer', minimum: 1 },
    },
    required: [
      'mode',
      'namespace',
      'identifier',
      'request_id',
      'min_ial',
      'min_aal',
      'request_timeout',
      'data_request_list',
      'data_request_params_salt_list',
      'request_message',
      'rp_id',
      'request_message_salt',
      'initial_salt',
      'creation_time',
      'chain_id',
      'height',
    ],
  },
  [messageTypes.DATA_REQUEST]: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    properties: {
      request_id: { type: 'string', minLength: 1 },
      mode: { type: 'number', enum: [1, 3] },
      namespace: { type: 'string', minLength: 1 },
      identifier: { type: 'string', minLength: 1 },
      service_data_request_list: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            service_id: { type: 'string', minLength: 1 },
            request_params: { type: 'string' },
            request_params_salt: { type: 'string', minLength: 1 },
          },
          required: ['service_id', 'request_params_salt'],
        },
      },
      request_message: { type: 'string' },
      request_message_salt: { type: 'string', minLength: 1 },
      response_private_data_list: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            idp_id: { type: 'string', minLength: 1 },
            accessor_id: { type: 'string', minLength: 1 },
          },
          required: ['idp_id'],
        },
      },
      creation_time: { type: 'integer', minimum: 1 },
      request_timeout: { type: 'integer', minimum: 1 },
      rp_id: { type: 'string', minLength: 1 },
      initial_salt: { type: 'string', minLength: 1 },
      chain_id: { type: 'string', minLength: 1 },
      height: { type: 'integer', minimum: 1 },
    },
    required: [
      'request_id',
      'mode',
      'namespace',
      'identifier',
      'service_data_request_list',
      'request_message',
      'request_message_salt',
      'response_accessor_id_list',
      'creation_time',
      'request_timeout',
      'rp_id',
      'initial_salt',
      'chain_id',
      'height',
    ],
  },
  [messageTypes.IDP_RESPONSE]: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    anyOf: [
      // Mode 1
      {
        properties: {
          request_id: { type: 'string', minLength: 1 },
          mode: { type: 'number', enum: [1] },
          idp_id: { type: 'string', minLength: 1 },
          chain_id: { type: 'string', minLength: 1 },
          height: { type: 'integer', minimum: 1 },
        },
        required: ['request_id', 'mode', 'idp_id', 'chain_id', 'height'],
      },
      // Mode 3
      {
        properties: {
          request_id: { type: 'string', minLength: 1 },
          mode: { type: 'number', enum: [3] },
          accessor_id: { type: 'string', minLength: 1 },
          padding: { type: 'string', minLength: 1 },
          idp_id: { type: 'string', minLength: 1 },
          chain_id: { type: 'string', minLength: 1 },
          height: { type: 'integer', minimum: 1 },
        },
        required: [
          'request_id',
          'mode',
          'accessor_id',
          'padding',
          'idp_id',
          'chain_id',
          'height',
        ],
      },
    ],
  },
};
