/*
Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED 

This file is part of NDID software.

NDID is the free software: you can redistribute it and/or modify  it under the terms of the Affero GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.

NDID is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the Affero GNU General Public License for more details.

You should have received a copy of the Affero GNU General Public License along with the NDID source code.  If not, see https://www.gnu.org/licenses/agpl.txt.

please contact info@ndid.co.th for any further questions
*/
export default {
  defsSchema: {
    definitions: {
      ial: { type: 'number', enum: [1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3] },
      aal: { type: 'number', enum: [1, 2.1, 2.2, 3] },
      ialString: {
        type: 'string',
        enum: ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3'],
      },
      aalString: {
        type: 'string',
        enum: ['1', '2.1', '2.2', '3'],
      },
      url: {
        type: 'string',
        format: 'uri',
        pattern: '^(https?)://',
      },
    },
  },
  GET: {
    '/utility/idp': {
      query: {
        properties: {
          min_ial: {
            $ref: 'defs#/definitions/ialString',
          },
          min_aal: {
            $ref: 'defs#/definitions/aalString',
          },
        },
      },
    },
    '/utility/idp/:namespace/:identifier': {
      query: {
        properties: {
          min_ial: {
            $ref: 'defs#/definitions/ialString',
          },
          min_aal: {
            $ref: 'defs#/definitions/aalString',
          },
        },
      },
    },
  },
  POST: {
    '/rp/requests/:namespace/:identifier': {
      params: {
        properties: {
          namespace: { type: 'string', minLength: 1 },
          identifier: { type: 'string', minLength: 1 },
        },
        required: ['namespace', 'identifier'],
      },
      body: {
        properties: {
          reference_id: { type: 'string', minLength: 1 },
          mode: { type: 'number', enum: [1, 3] },
          idp_id_list: {
            type: 'array',
            items: {
              type: 'string',
              minimum: 1,
            },
          },
          callback_url: {
            $ref: 'defs#/definitions/url',
          },
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
                request_params: {
                  type: 'string',
                },
              },
              required: ['service_id', 'min_as'],
            },
          },
          request_message: { type: 'string' },
          min_ial: { $ref: 'defs#/definitions/ial' },
          min_aal: { $ref: 'defs#/definitions/aal' },
          min_idp: { type: 'integer', minimum: 1 },
          request_timeout: { type: 'integer', minimum: 0 },
        },
        required: [
          'reference_id',
          'mode',
          'callback_url',
          'request_message',
          'min_ial',
          'min_aal',
          'min_idp',
          'request_timeout',
        ],
      },
    },
    '/rp/requests/close': {
      body: {
        properties: {
          request_id: { type: 'string', minLength: 1 },
        },
        required: ['request_id'],
      },
    },
    '/rp/callback': {
      body: {
        properties: {
          error_url: {
            $ref: 'defs#/definitions/url',
          },
        },
      },
    },
    '/idp/callback': {
      body: {
        properties: {
          incoming_request_url: {
            $ref: 'defs#/definitions/url',
          },
          identity_result_url: {
            $ref: 'defs#/definitions/url',
          },
          accessor_sign_url: {
            $ref: 'defs#/definitions/url',
          },
          error_url: {
            $ref: 'defs#/definitions/url',
          },
        },
      },
    },
    '/idp/response': {
      body: {
        properties: {
          request_id: { type: 'string', minimum: 1 },
          ial: { $ref: 'defs#/definitions/ial' },
          aal: { $ref: 'defs#/definitions/aal' },
          secret: { type: 'string' },
          status: {
            type: 'string',
            enum: ['accept', 'reject'],
          },
          signature: { type: 'string' },
          accessor_id: { type: 'string' },
        },
        required: [
          'request_id',
          'ial',
          'aal',
          // 'secret', Not required in mode 1
          'status',
          'signature',
          // 'accessor_id', Not required in mode 1
        ],
      },
    },
    '/as/service/:service_id': {
      body: {
        properties: {
          min_ial: { $ref: 'defs#/definitions/ial' },
          min_aal: { $ref: 'defs#/definitions/aal' },
          url: {
            $ref: 'defs#/definitions/url',
          },
        },
        required: ['min_ial', 'min_aal', 'url'],
      },
    },
    '/as/data/:request_id/:service_id': {
      body: {
        properties: {
          data: { type: 'string', minLength: 1 },
        },
        required: ['data'],
      },
    },
    '/as/callback': {
      body: {
        properties: {
          error_url: {
            $ref: 'defs#/definitions/url',
          },
        },
      },
    },
    '/dpki/node/create': {
      body: {
        properties: {
          node_id: { type: 'string', minLength: 1 },
          node_name: { type: 'string', minLength: 1 },
          node_key: { type: 'string', minLength: 1 },
          // node_key_type: { type: 'string' },
          // node_key_method: { type: 'string' },
          node_master_key: { type: 'string', minLength: 1 },
          // node_master_key_type: { type: 'string' },
          // node_master_key_method: { type: 'string' },
          role: { type: 'string', enum: ['rp', 'idp', 'as'] },
          min_ial: { $ref: 'defs#/definitions/ial' },
          min_aal: { $ref: 'defs#/definitions/aal' },
        },
        required: [
          'node_id',
          'node_name',
          'node_key',
          'node_master_key',
          'role',
          'min_ial',
          'min_aal',
        ],
      },
    },
    '/dpki/node/update': {
      body: {
        properties: {
          node_key: { type: 'string', minLength: 1 },
          node_master_key: { type: 'string', minLength: 1 },
        },
        anyOf: [
          {
            required: ['node_key'],
          },
          {
            required: ['node_master_key'],
          },
        ],
      },
    },
    '/dpki/node/register_callback': {
      body: {
        properties: {
          sign_url: {
            $ref: 'defs#/definitions/url',
          },
          decrypt_url: {
            $ref: 'defs#/definitions/url',
          },
        },
        anyOf: [
          {
            required: ['sign_url'],
          },
          {
            required: ['decrypt_url'],
          },
        ],
      },
    },
    '/dpki/node/register_callback_master': {
      body: {
        properties: {
          url: {
            $ref: 'defs#/definitions/url',
          },
        },
        required: ['url'],
      },
    },
    '/identity/': {
      body: {
        properties: {
          reference_id: { type: 'string', minLength: 1 },
          namespace: { type: 'string', minLength: 1 },
          identifier: { type: 'string', minLength: 1 },
          accessor_type: { type: 'string', minLength: 1 },
          accessor_public_key: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
          ial: { $ref: 'defs#/definitions/ial' },
        },
        required: [
          'reference_id',
          'namespace',
          'identifier',
          'accessor_type',
          'accessor_public_key',
          //'accessor_id',
          'ial',
        ],
      },
    },
    '/identity/:namespace/:identifier': {
      body: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            namespace: { type: 'string', minLength: 1 },
            identifier: { type: 'string', minLength: 1 },
          },
          required: ['namespace', 'identifier'],
        },
      },
    },
    '/identity/:namespace/:identifier/endorsement': {
      body: {
        properties: {
          // TODO: After v1.0
        },
      },
    },
    '/identity/:namespace/:identifier/accessors': {
      body: {
        properties: {
          reference_id: { type: 'string', minLength: 1 },
          accessor_type: { type: 'string', minLength: 1 },
          accessor_public_key: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
        },
        required: [
          'reference_id',
          'accessor_type',
          'accessor_public_key',
        ],
      },
    },
  },
};
