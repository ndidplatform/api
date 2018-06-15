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
    },
  },
  GET: {
    '/identity/:namespace/:identifier/requests/history': {
      query: {
        properties: {
          count: {
            type: 'string',
            pattern: '^\\d*[1-9]\\d*$', // number (int) > 0
          },
        },
      },
    },
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
          idp_list: {
            type: 'array',
            items: {
              type: 'string',
              minimum: 1,
            },
          },
          callback_url: {
            type: 'string',
            format: 'uri',
            pattern: '^(https?)://',
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
                count: {
                  type: 'integer',
                  minimum: 1,
                },
                request_params: {
                  type: 'object',
                },
              },
              required: ['service_id'],
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
    '/idp/callback': {
      body: {
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            pattern: '^(https?)://',
          },
        },
        required: ['url'],
      },
    },
    '/idp/accessor/callback': {
      body: {
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            pattern: '^(https?)://',
          },
        },
        required: ['url'],
      },
    },
    '/idp/response': {
      body: {
        properties: {
          request_id: { type: 'string', minimum: 1 },
          namespace: { type: 'string', minLength: 1 },
          identifier: { type: 'string', minLength: 1 },
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
          // 'namespace',
          // 'identifier',
          'ial',
          'aal',
          'secret',
          'status',
          'signature',
          'accessor_id',
        ],
      },
    },
    '/as/service/:service_id': {
      body: {
        properties: {
          min_ial: { $ref: 'defs#/definitions/ial' },
          min_aal: { $ref: 'defs#/definitions/aal' },
          url: {
            type: 'string',
            format: 'uri',
            pattern: '^(https?)://',
          },
        },
        required: ['min_ial', 'min_aal', 'url'],
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
            type: 'string',
            format: 'uri',
            pattern: '^(https?)://',
          },
          decrypt_url: {
            type: 'string',
            format: 'uri',
            pattern: '^(https?)://',
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
            type: 'string',
            format: 'uri',
            pattern: '^(https?)://',
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
          'accessor_id',
        ],
      },
    },
  },
};
