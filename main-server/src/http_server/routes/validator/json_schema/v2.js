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
      keyType: {
        type: 'string',
        enum: ['RSA'],
      },
      signMethod: {
        type: 'string',
        enum: ['RSA-SHA256'],
      },
    },
  },
  GET: {
    '/utility/idp': {
      query: {
        $schema: 'http://json-schema.org/draft-07/schema#',
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
        $schema: 'http://json-schema.org/draft-07/schema#',
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
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          namespace: { type: 'string', minLength: 1 },
          identifier: { type: 'string', minLength: 1 },
        },
        required: ['namespace', 'identifier'],
      },
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          mode: { type: 'number', enum: [1, 3] },
          idp_id_list: {
            type: 'array',
            items: {
              type: 'string',
              minimum: 1,
            },
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
          request_timeout: { type: 'integer', minimum: 1 },
        },
        required: [
          'reference_id',
          'callback_url',
          'mode',
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
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          request_id: { type: 'string', minLength: 1 },
        },
        required: ['reference_id', 'callback_url', 'request_id'],
      },
    },
    '/rp/callback': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          error_url: {
            $ref: 'defs#/definitions/url',
          },
        },
      },
    },
    '/idp/callback': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          incoming_request_url: {
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
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
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
          'reference_id',
          'callback_url',
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
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          min_ial: { $ref: 'defs#/definitions/ial' },
          min_aal: { $ref: 'defs#/definitions/aal' },
          url: {
            $ref: 'defs#/definitions/url',
          },
        },
        required: ['reference_id', 'callback_url'],
      },
    },
    '/as/data/:request_id/:service_id': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          data: { type: 'string', minLength: 1 },
        },
        required: ['reference_id', 'callback_url', 'data'],
      },
    },
    '/as/callback': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          error_url: {
            $ref: 'defs#/definitions/url',
          },
        },
      },
    },
    '/dpki/node/create': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          node_id: { type: 'string', minLength: 1 },
          node_name: { type: 'string', minLength: 1 },
          node_key: { type: 'string', minLength: 1 },
          node_key_type: { $ref: 'defs#/definitions/keyType' },
          node_sign_method: { $ref: 'defs#/definitions/signMethod' },
          node_master_key: { type: 'string', minLength: 1 },
          node_master_key_type: { $ref: 'defs#/definitions/keyType' },
          node_master_sign_method: { $ref: 'defs#/definitions/signMethod' },
          role: { type: 'string', enum: ['rp', 'idp', 'as'] },
          max_ial: { $ref: 'defs#/definitions/ial' },
          max_aal: { $ref: 'defs#/definitions/aal' },
        },
        required: [
          'reference_id',
          'callback_url',
          'node_id',
          'node_name',
          'node_key',
          // 'node_key_type',
          // 'node_sign_method',
          'node_master_key',
          // 'node_master_key_type',
          // 'node_master_sign_method',
          'role',
        ],
      },
    },
    '/dpki/node/update': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          node_key: { type: 'string', minLength: 1 },
          node_key_type: { $ref: 'defs#/definitions/keyType' },
          node_sign_method: { $ref: 'defs#/definitions/signMethod' },
          node_master_key: { type: 'string', minLength: 1 },
          node_master_key_type: { $ref: 'defs#/definitions/keyType' },
          node_master_sign_method: { $ref: 'defs#/definitions/signMethod' },
          check_string: { type: 'string', minLength: 1 },
          signed_check_string: { type: 'string', minLength: 1 },
          master_signed_check_string: { type: 'string', minLength: 1 },
        },
        anyOf: [
          {
            required: [
              'reference_id',
              'callback_url',
              'node_key',
              // 'node_key_type',
              // 'node_sign_method',
            ],
          },
          {
            required: [
              'reference_id',
              'callback_url',
              'node_master_key',
              // 'node_master_key_type',
              // 'node_master_sign_method',
            ],
          },
        ],
      },
    },
    '/dpki/node/callback': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          sign_url: {
            $ref: 'defs#/definitions/url',
          },
          master_sign_url: {
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
            required: ['master_sign_url'],
          },
          {
            required: ['decrypt_url'],
          },
        ],
      },
    },
    '/identity/': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          namespace: { type: 'string', minLength: 1 },
          identifier: { type: 'string', minLength: 1 },
          accessor_type: { $ref: 'defs#/definitions/keyType' },
          accessor_public_key: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
          ial: { $ref: 'defs#/definitions/ial' },
          request_message: { type: 'string' },
        },
        required: [
          'reference_id',
          'callback_url',
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
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          identifier_list: {
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
        required: ['reference_id', 'callback_url', 'identifier_list'],
      },
    },
    '/identity/:namespace/:identifier/ial': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          ial: { $ref: 'defs#/definitions/ial' },
        },
        required: ['reference_id', 'callback_url', 'ial'],
      },
    },
    '/identity/:namespace/:identifier/accessors': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          accessor_type: { $ref: 'defs#/definitions/keyType' },
          accessor_public_key: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
          request_message: { type: 'string' },
        },
        required: [
          'reference_id',
          'callback_url',
          'accessor_type',
          'accessor_public_key',
        ],
      },
    },
    '/identity/:namespace/:identifier/accessors_revoke': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          accessor_id: { type: 'string', minLength: 1 },
          request_message: { type: 'string' },
        },
        required: ['reference_id', 'callback_url', 'accessor_id'],
      },
    },
    '/identity/:namespace/:identifier/endorsement': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          // TODO: After v1.0
        },
      },
    },
    '/identity/requests/close': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          request_id: { type: 'string', minLength: 1 },
        },
        required: ['reference_id', 'callback_url', 'request_id'],
      },
    },
    '/identity/secret': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
          namespace: { type: 'string', minLength: 1 },
          identifier: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
        },
        required: ['accessor_id', 'namespace', 'identifier'],
      },
    },
  },
};
