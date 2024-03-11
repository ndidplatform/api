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
      keyAlgorithmForSigning: {
        type: 'string',
        enum: ['RSA', 'EC', 'Ed25519'],
      },
      keyAlgorithmForEncryption: {
        type: 'string',
        enum: ['RSA'],
      },
      signingAlgorithm: {
        type: 'string',
        enum: [
          'RSASSA_PSS_SHA_256',
          'RSASSA_PSS_SHA_384',
          'RSASSA_PSS_SHA_512',
          'RSASSA_PKCS1_V1_5_SHA_256',
          'RSASSA_PKCS1_V1_5_SHA_384',
          'RSASSA_PKCS1_V1_5_SHA_512',
          'ECDSA_SHA_256',
          'ECDSA_SHA_384',
          'Ed25519',
        ],
      },
      encryptionAlgorithm: {
        type: 'string',
        enum: ['RSAES_PKCS1_V1_5', 'RSAES_OAEP_SHA_1', 'RSAES_OAEP_SHA_256'],
      },
      proxyNodeConfig: {
        type: 'string',
        enum: ['KEY_ON_PROXY', 'KEY_ON_NODE'],
      },
      errorCode: {
        type: 'integer',
        minimum: 1,
      },
    },
  },
  GET: {},
  POST: {
    '/ndid/init_ndid': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          signing_public_key: { type: 'string', minLength: 1 },
          signing_key_algorithm: { $ref: 'defs#/definitions/keyAlgorithmForSigning' },
          signing_algorithm: { $ref: 'defs#/definitions/signingAlgorithm' },
          signing_master_public_key: { type: 'string', minLength: 1 },
          signing_master_key_algorithm: {
            $ref: 'defs#/definitions/keyAlgorithmForSigning',
          },
          signing_master_algorithm: {
            $ref: 'defs#/definitions/signingAlgorithm',
          },
          encryption_public_key: { type: 'string', minLength: 1 },
          encryption_key_algorithm: { $ref: 'defs#/definitions/keyAlgorithmForEncryption' },
          encryption_algorithm: {
            $ref: 'defs#/definitions/encryptionAlgorithm',
          },
          chain_history_info: { type: 'string' },
        },
        required: [
          'signing_public_key',
          'signing_key_algorithm',
          'signing_algorithm',
          'signing_master_public_key',
          'signing_master_key_algorithm',
          'signing_master_algorithm',
          'encryption_public_key',
          'encryption_key_algorithm',
          'encryption_algorithm',
        ],
      },
    },
    '/ndid/register_node': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          node_name: { type: 'string', minLength: 1 },
          signing_public_key: { type: 'string', minLength: 1 },
          signing_key_algorithm: { $ref: 'defs#/definitions/keyAlgorithmForSigning' },
          signing_algorithm: { $ref: 'defs#/definitions/signingAlgorithm' },
          signing_master_public_key: { type: 'string', minLength: 1 },
          signing_master_key_algorithm: {
            $ref: 'defs#/definitions/keyAlgorithmForSigning',
          },
          signing_master_algorithm: {
            $ref: 'defs#/definitions/signingAlgorithm',
          },
          encryption_public_key: { type: 'string', minLength: 1 },
          encryption_key_algorithm: { $ref: 'defs#/definitions/keyAlgorithmForEncryption' },
          encryption_algorithm: {
            $ref: 'defs#/definitions/encryptionAlgorithm',
          },
          role: { type: 'string', enum: ['rp', 'idp', 'as', 'proxy'] },
          max_ial: { $ref: 'defs#/definitions/ial' },
          max_aal: { $ref: 'defs#/definitions/aal' },
          on_the_fly_support: { type: 'boolean' },
          agent: { type: 'boolean' },
          node_id_whitelist_active: { type: 'boolean' },
          node_id_whitelist: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
          },
        },
        required: [
          'node_id',
          'node_name',
          'signing_public_key',
          'signing_key_algorithm',
          'signing_algorithm',
          'signing_master_public_key',
          'signing_master_key_algorithm',
          'signing_master_algorithm',
          'encryption_public_key',
          'encryption_key_algorithm',
          'encryption_algorithm',
          'role',
        ],
      },
    },
    '/ndid/update_node': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          node_name: { type: 'string', minLength: 1 },
          max_ial: { $ref: 'defs#/definitions/ial' },
          max_aal: { $ref: 'defs#/definitions/aal' },
          on_the_fly_support: { type: 'boolean' },
          agent: { type: 'boolean' },
          node_id_whitelist_active: { type: 'boolean' },
          node_id_whitelist: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
          },
        },
        required: ['node_id'],
      },
    },
    '/ndid/enable_node': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
    '/ndid/disable_node': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
    '/ndid/set_node_token': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0 },
        },
        required: ['node_id', 'amount'],
      },
    },
    '/ndid/add_node_token': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0 },
        },
        required: ['node_id', 'amount'],
      },
    },
    '/ndid/reduce_node_token': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0 },
        },
        required: ['node_id', 'amount'],
      },
    },
    '/ndid/create_namespace': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          namespace: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          allowed_identifier_count_in_reference_group: {
            type: 'integer',
            minimum: -1,
          },
          allowed_active_identifier_count_in_reference_group: {
            type: 'integer',
            minimum: -1,
          },
        },
        required: ['namespace'],
      },
    },
    '/ndid/update_namespace': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          namespace: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          allowed_identifier_count_in_reference_group: {
            type: 'integer',
            minimum: -1,
          },
          allowed_active_identifier_count_in_reference_group: {
            type: 'integer',
            minimum: -1,
          },
        },
        required: ['namespace'],
      },
    },
    '/ndid/enable_namespace': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          namespace: { type: 'string', minLength: 1 },
        },
        required: ['namespace'],
      },
    },
    '/ndid/disable_namespace': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          namespace: { type: 'string', minLength: 1 },
        },
        required: ['namespace'],
      },
    },
    '/ndid/create_service': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          service_id: { type: 'string', minLength: 1 },
          service_name: { type: 'string', minLength: 1 },
        },
        required: ['service_id', 'service_name'],
      },
    },
    '/ndid/update_service': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          service_id: { type: 'string', minLength: 1 },
          service_name: { type: 'string', minLength: 1 },
        },
        required: ['service_id', 'service_name'],
      },
    },
    '/ndid/enable_service': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['service_id'],
      },
    },
    '/ndid/disable_service': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['service_id'],
      },
    },
    '/ndid/set_service_price_ceiling': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          service_id: { type: 'string', minLength: 1 },
          price_ceiling_by_currency_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                currency: { type: 'string', minLength: 1 },
                price: { type: 'number', minimum: 0 },
              },
              required: ['currency', 'price'],
            },
            minItems: 1,
            uniqueItemProperties: ['currency'],
          },
        },
        required: ['service_id', 'price_ceiling_by_currency_list'],
      },
    },
    '/ndid/set_service_price_min_effective_datetime_delay': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          service_id: { type: 'string', minLength: 1 },
          duration_second: { type: 'integer', minimum: 1 },
        },
        required: ['duration_second'],
      },
    },
    '/ndid/set_validator': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          public_key: { type: 'string', minLength: 1 },
          power: { type: 'number', minimum: 0 },
        },
        required: ['public_key', 'power'],
      },
    },
    '/ndid/approve_service': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id', 'service_id'],
      },
    },
    '/ndid/enable_service_destination': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id', 'service_id'],
      },
    },
    '/ndid/disable_service_destination': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id', 'service_id'],
      },
    },
    '/ndid/add_node_to_proxy_node': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          proxy_node_id: { type: 'string', minLength: 1 },
          config: { $ref: 'defs#/definitions/proxyNodeConfig' },
        },
        required: ['node_id', 'proxy_node_id', 'config'],
      },
    },
    '/ndid/update_node_proxy_node': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          proxy_node_id: { type: 'string', minLength: 1 },
          config: { $ref: 'defs#/definitions/proxyNodeConfig' },
        },
        required: ['node_id', 'proxy_node_id'],
      },
    },
    '/ndid/remove_node_from_proxy_node': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
    '/ndid/set_last_block': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          block_height: { type: 'integer', minimum: -1 },
        },
        required: ['block_height'],
      },
    },
    '/ndid/set_allowed_mode_list': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          purpose: { type: 'string' },
          allowed_mode_list: {
            type: 'array',
            items: {
              type: 'number',
              enum: [1, 2, 3],
            },
            uniqueItems: true,
          },
        },
        required: ['purpose', 'allowed_mode_list'],
      },
    },
    '/ndid/set_allowed_min_ial_for_register_identity_at_first_idp': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          min_ial: { $ref: 'defs#/definitions/ial' },
        },
        required: ['min_ial'],
      },
    },
    '/ndid/get_node_id_list': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['', 'rp', 'idp', 'as'] },
        },
      },
    },
    '/ndid/add_error_code': {
      body: {
        type: 'object',
        properties: {
          error_code: { $ref: 'defs#/definitions/errorCode' },
          type: { type: 'string', enum: ['idp', 'as'] },
          description: { type: 'string' },
        },
        required: ['error_code', 'type', 'description'],
      },
    },
    '/ndid/remove_error_code': {
      body: {
        type: 'object',
        properties: {
          error_code: { $ref: 'defs#/definitions/errorCode' },
          type: { type: 'string', enum: ['idp', 'as'] },
        },
        required: ['error_code', 'type'],
      },
    },
    '/ndid/add_request_type': {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
        },
        required: ['name'],
      },
    },
    '/ndid/remove_request_type': {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
        },
        required: ['name'],
      },
    },
    '/ndid/add_suppressed_identity_modification_notification_node': {
      body: {
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
    '/ndid/remove_suppressed_identity_modification_notification_node': {
      body: {
        type: 'object',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
  },
};
