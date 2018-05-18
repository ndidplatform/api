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
        required: ['reference_id', 'min_ial', 'min_aal'],
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
            // TODO
            // May validate value to be one of 'accept' and 'reject'
          },
          signature: { type: 'string' },
          accessor_id: { type: 'string' },
        },
        required: [
          'request_id',
          'namespace',
          'identifier',
          'ial',
          'aal',
          'secret',
          'status',
          'signature',
          'accessor_id',
        ],
      },
    },
    /*'/as/callback': {
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
    },*/
    '/as/service/:service_id': {
      body: {
        properties: {
          service_id: { type: 'string', minLength: 1 },
          service_name: { type: 'string', minLength: 1 },
          min_ial: { $ref: 'defs#/definitions/ial' },
          min_aal: { $ref: 'defs#/definitions/aal' },
          url: {
            type: 'string',
            format: 'uri',
            pattern: '^(https?)://',
          },
        },
        required: ['service_id'],
      },
    },
    '/dpki/node/create': {
      body: {
        properties: {
          // TODO
        },
      },
    },
    '/dpki/node/update': {
      body: {
        properties: {
          // TODO
        },
      },
    },
    '/dpki/node/register_callback': {
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
          namespace: { type: 'string', minLength: 1 },
          identifier: { type: 'string', minLength: 1 },
          secret: { type: 'string', minLength: 1 },
          accessor_type: { type: 'string', minLength: 1 },
          accessor_key: { type: 'string', minLength: 1 },
          accessor_id: { type: 'string', minLength: 1 },
        },
        required: [
          'namespace',
          'identifier',
          'secret',
          'accessor_type',
          'accessor_key',
          'accessor_id',
        ],
      },
    },
    '/identity/:namespace/:identifier': {
      body: {
        properties: {
          // TODO
        },
      },
    },
    '/identity/:namespace/:identifier/endorsement': {
      body: {
        properties: {
          // TODO
        },
      },
    },
    '/identity/:namespace/:identifier/accessors': {
      body: {
        properties: {
          // TODO
        },
      },
    },
  },
};
