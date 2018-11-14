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
      proxyNodeConfig: {
        type: 'string',
        enum: ['KEY_ON_PROXY', 'KEY_ON_NODE'],
      },
    },
  },
  GET: {},
  POST: {
    '/ndid/initNDID': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          public_key: { type: 'string', minLength: 1 },
          public_key_type: { $ref: 'defs#/definitions/keyType' },
          master_public_key: { type: 'string', minLength: 1 },
          master_public_key_type: { $ref: 'defs#/definitions/keyType' },
          chain_history_info: { type: 'string' },
        },
        required: [
          'public_key',
          // 'public_key_type',
          'master_public_key',
          // 'master_public_key_type',
        ],
      },
    },
    '/ndid/registerNode': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          node_name: { type: 'string', minLength: 1 },
          node_key: { type: 'string', minLength: 1 },
          node_key_type: { $ref: 'defs#/definitions/keyType' },
          node_sign_method: { $ref: 'defs#/definitions/signMethod' },
          node_master_key: { type: 'string', minLength: 1 },
          node_master_key_type: { $ref: 'defs#/definitions/keyType' },
          node_master_sign_method: { $ref: 'defs#/definitions/signMethod' },
          role: { type: 'string', enum: ['rp', 'idp', 'as', 'proxy'] },
          max_ial: { $ref: 'defs#/definitions/ial' },
          max_aal: { $ref: 'defs#/definitions/aal' },
        },
        required: [
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
    '/ndid/updateNode': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          node_name: { type: 'string', minLength: 1 },
          max_ial: { $ref: 'defs#/definitions/ial' },
          max_aal: { $ref: 'defs#/definitions/aal' },
        },
        required: ['node_id'],
      },
    },
    '/ndid/enableNode': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
    '/ndid/disableNode': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
    '/ndid/setNodeToken': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0 },
        },
        required: ['node_id', 'amount'],
      },
    },
    '/ndid/addNodeToken': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0 },
        },
        required: ['node_id', 'amount'],
      },
    },
    '/ndid/reduceNodeToken': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0 },
        },
        required: ['node_id', 'amount'],
      },
    },
    '/ndid/namespaces': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          namespace: { type: 'string', minLength: 1 },
          description: { type: 'string' },
        },
        required: ['namespace'],
      },
    },
    '/ndid/services': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          service_id: { type: 'string', minLength: 1 },
          service_name: { type: 'string', minLength: 1 },
        },
        required: ['service_id', 'service_name'],
      },
    },
    '/ndid/services/:service_id': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          service_name: { type: 'string', minLength: 1 },
        },
        required: ['service_name'],
      },
    },
    '/ndid/validator': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          public_key: { type: 'string', minLength: 1 },
          power: { type: 'number', minimum: 0 },
        },
        required: ['public_key', 'power'],
      },
    },
    '/ndid/setTimeoutBlockRegisterIdentity': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          blocks_to_timeout: { type: 'number', minimum: 0 },
        },
        required: ['blocks_to_timeout'],
      },
    },
    '/ndid/approveService': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id', 'service_id'],
      },
    },
    '/ndid/enableServiceDestination': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id', 'service_id'],
      },
    },
    '/ndid/disableServiceDestination': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          service_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id', 'service_id'],
      },
    },
    '/ndid/addNodeToProxyNode': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          proxy_node_id: { type: 'string', minLength: 1 },
          config: { $ref: 'defs#/definitions/proxyNodeConfig' },
        },
        required: ['node_id', 'proxy_node_id', 'config'],
      },
    },
    '/ndid/updateNodeProxyNode': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
          proxy_node_id: { type: 'string', minLength: 1 },
          config: { $ref: 'defs#/definitions/proxyNodeConfig' },
        },
        required: ['node_id', 'proxy_node_id'],
      },
    },
    '/ndid/removeNodeFromProxyNode': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          node_id: { type: 'string', minLength: 1 },
        },
        required: ['node_id'],
      },
    },
    '/ndid/setLastBlock': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          block_height: { type: 'integer', minimum: -1 },
        },
        required: ['block_height'],
      },
    },
  },
};
