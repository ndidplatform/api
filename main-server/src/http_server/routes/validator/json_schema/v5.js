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
      modeString: {
        type: 'string',
        enum: ['2', '3'],
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
      booleanString: {
        type: 'string',
        enum: ['false', 'true'],
      },
      errorCode: {
        type: 'integer',
        minimum: 1,
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
          agent: {
            $ref: 'defs#/definitions/booleanString',
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
          mode: {
            $ref: 'defs#/definitions/modeString',
          },
        },
      },
    },
    '/utility/service_price_ceiling': {
      query: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['service_id'],
      },
    },
    '/utility/as/service_price/:service_id': {
      query: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
    '/idp/request_message_padded_hash': {
      query: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          request_id: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
        },
        required: ['request_id', 'accessor_id'],
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
        anyOf: [
          // Mode 1
          {
            properties: {
              node_id: { type: 'string', minLength: 1 },
              reference_id: { type: 'string', minLength: 1 },
              callback_url: { $ref: 'defs#/definitions/url' },
              mode: { type: 'number', enum: [1] },
              idp_id_list: {
                type: 'array',
                items: {
                  type: 'string',
                  minLength: 1,
                },
                uniqueItems: true,
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
                        minLength: 1,
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
                uniqueItems: true,
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
          // Mode 2,3
          {
            properties: {
              node_id: { type: 'string', minLength: 1 },
              reference_id: { type: 'string', minLength: 1 },
              callback_url: { $ref: 'defs#/definitions/url' },
              mode: { type: 'number', enum: [2, 3] },
              idp_id_list: {
                type: 'array',
                items: {
                  type: 'string',
                  minLength: 1,
                },
                uniqueItems: true,
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
                        minLength: 1,
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
                uniqueItems: true,
              },
              request_message: { type: 'string' },
              min_ial: { $ref: 'defs#/definitions/ial' },
              min_aal: { $ref: 'defs#/definitions/aal' },
              min_idp: { type: 'integer', minimum: 1 },
              request_timeout: { type: 'integer', minimum: 1 },
              bypass_identity_check: { type: 'boolean' },
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
              'bypass_identity_check',
            ],
          },
        ],
      },
    },
    '/rp/request_close': {
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
          incoming_request_status_update_url: {
            $ref: 'defs#/definitions/url',
          },
          identity_modification_notification_url: {
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
          request_id: { type: 'string', minLength: 1 },
          ial: { $ref: 'defs#/definitions/ial' },
          aal: { $ref: 'defs#/definitions/aal' },
          status: {
            type: 'string',
            enum: ['accept', 'reject'],
          },
          accessor_id: { type: 'string' },
          signature: { type: 'string', minLength: 1 },
        },
        required: [
          'reference_id',
          'callback_url',
          'request_id',
          'ial',
          'aal',
          'status',
          // 'accessor_id', Not required in mode 1
          'signature',
        ],
      },
    },
    '/idp/error_response': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          request_id: { type: 'string', minLength: 1 },
          error_code: { $ref: 'defs#/definitions/errorCode' },
        },
        required: ['reference_id', 'callback_url', 'request_id', 'error_code'],
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
          supported_namespace_list: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            uniqueItems: true,
          },
        },
        required: ['reference_id', 'callback_url'],
      },
    },
    '/as/payment_received_log/:request_id/:service_id': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
      },
    },
    '/as/service_price/:service_id': {
      params: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['service_id'],
      },
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          price_by_currency_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                currency: { type: 'string', minLength: 1 },
                min_price: { type: 'number', minimum: 0 },
                max_price: { type: 'number', minimum: 0 },
              },
              required: ['currency', 'min_price', 'max_price'],
            },
            minItems: 1,
            uniqueItemProperties: ['currency'],
          },
          effective_datetime: { type: 'string', format: 'date-time' }, // ISO 8601 format
          more_info_url: { $ref: 'defs#/definitions/url' },
          detail: { type: 'string', minLength: 1 },
        },
        required: [
          'reference_id',
          'callback_url',
          'price_by_currency_list',
          'effective_datetime',
        ],
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
    '/as/error/:request_id/:service_id': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          error_code: { $ref: 'defs#/definitions/errorCode' },
        },
        required: ['reference_id', 'callback_url', 'error_code'],
      },
    },
    '/as/callback': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          incoming_request_status_update_url: {
            $ref: 'defs#/definitions/url',
          },
          error_url: {
            $ref: 'defs#/definitions/url',
          },
        },
      },
    },
    '/proxy/callback': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          error_url: {
            $ref: 'defs#/definitions/url',
          },
        },
      },
    },
    '/node/create': {
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
    '/node/update': {
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
          supported_request_message_data_url_type_list: {
            type: 'array',
            items: {
              type: 'string',
            },
            uniqueItems: true,
          },
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
          {
            required: [
              'reference_id',
              'callback_url',
              'supported_request_message_data_url_type_list',
            ],
          },
        ],
      },
    },
    '/node/callback': {
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
          message_queue_send_success_url: {
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
          {
            required: ['message_queue_send_success_url'],
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
          identity_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                namespace: { type: 'string', minLength: 1 },
                identifier: { type: 'string', minLength: 1 },
              },
              required: ['namespace', 'identifier'],
            },
            minItems: 1,
            uniqueItems: true,
          },
          mode: { type: 'number', enum: [2, 3] },
          accessor_type: { $ref: 'defs#/definitions/keyType' },
          accessor_public_key: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
          ial: { $ref: 'defs#/definitions/ial' },
          lial: { type: 'boolean' },
          laal: { type: 'boolean' },
          request_message: { type: 'string' },
        },
        required: [
          'reference_id',
          'callback_url',
          'identity_list',
          'mode',
          'accessor_type',
          'accessor_public_key',
          //'accessor_id', // omit to let system auto generate
          'ial',
          'lial',
          'laal',
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
          identity_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                namespace: { type: 'string', minLength: 1 },
                identifier: { type: 'string', minLength: 1 },
              },
              required: ['namespace', 'identifier'],
            },
            minItems: 1,
            uniqueItems: true,
          },
        },
        required: ['reference_id', 'callback_url', 'identity_list'],
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
          accessor_id: { type: 'string', minLength: 1 },
          accessor_type: { $ref: 'defs#/definitions/keyType' },
          accessor_public_key: { type: 'string', minLength: 1 },
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
    '/identity/:namespace/:identifier/accessor_revoke': {
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
    '/identity/:namespace/:identifier/accessor_revoke_and_add': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          revoking_accessor_id: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
          accessor_type: { $ref: 'defs#/definitions/keyType' },
          accessor_public_key: { type: 'string', minLength: 1 },
          request_message: { type: 'string' },
        },
        required: [
          'reference_id',
          'callback_url',
          'revoking_accessor_id',
          'accessor_type',
          'accessor_public_key',
        ],
      },
    },
    '/identity/:namespace/:identifier/association_revoke': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          request_message: { type: 'string' },
        },
        required: ['reference_id', 'callback_url'],
      },
    },
    '/identity/:namespace/:identifier/mode': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          request_message: { type: 'string' },
        },
        required: ['reference_id', 'callback_url'],
      },
    },
    '/identity/:namespace/:identifier/removal_from_reference_group': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          request_message: { type: 'string' },
        },
        required: ['reference_id', 'callback_url'],
      },
    },
    '/identity/:namespace/:identifier/reference_group_merge': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          reference_id: { type: 'string', minLength: 1 },
          callback_url: { $ref: 'defs#/definitions/url' },
          namespace_to_merge: { type: 'string', minLength: 1 },
          identifier_to_merge: { type: 'string', minLength: 1 },
          request_message: { type: 'string' },
        },
        required: [
          'reference_id',
          'callback_url',
          'namespace_to_merge',
          'identifier_to_merge',
        ],
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
    '/identity_request/request_close': {
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
  },
};
