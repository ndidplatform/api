// TODO
export default {
  GET: {},
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
          idp_list: { type: 'array' },
          callback_url: { type: 'string', format: 'url-with-local-ip' },
          data_request_list: { type: 'array' },
          request_message: { type: 'string' },
          min_ial: { type: 'number', minimum: 1 },
          min_aal: { type: 'number', minimum: 1 },
          min_idp: { type: 'number', minimum: 1 },
          request_timeout: { type: 'number', minimum: 0 },
        },
        required: ['reference_id', 'callback_url', 'min_ial', 'min_aal'],
      },
    },
    '/idp/callback': {
      body: {
        properties: {
          url: { type: 'string', format: 'url-with-local-ip' },
        },
        required: ['url'],
      },
    },
  },
};
