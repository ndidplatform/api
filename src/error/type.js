export default {
  // Server errors
  UNKNOWN_ERROR: {
    code: 10000,
    message: 'Unknown Error',
  },
  TENDERMINT_HTTP_CALL_ERROR: {
    code: 10001,
    message: 'Cannot connect to tendermint HTTP endpoint',
  },
  TENDERMINT_QUERY_JSON_RPC_ERROR: {
    code: 10002,
    message: 'Tendermint JSON-RPC call error (query)',
  },
  TENDERMINT_QUERY_ERROR: {
    code: 10003,
    message: 'Tendermint query failed',
  },
  TENDERMINT_QUERY_RESULT_JSON_PARSE_ERROR: {
    code: 10004,
    message: 'Cannot parse Tendermint query result JSON',
  },
  TENDERMINT_TRANSACT_JSON_RPC_ERROR: {
    code: 10005,
    message: 'Tendermint JSON-RPC call error (transact)',
  },
  TENDERMINT_TRANSACT_ERROR: {
    code: 10006,
    message: 'Tendermint transact failed',
  },
  TENDERMINT_SYNCING: {
    code: 10007,
    message: 'Syncing blockchain data. Please try again later.',
  },
  TENDERMINT_NOT_CONNECTED: {
    code: 10008,
    message: 'Not connected to Tendermint. Please try again later.',
  },
  BODY_PARSER_ERROR: {
    code: 10009,
    message: 'Body parsing failed',
  },
  EXTERNAL_SIGN_URL_NOT_SET: {
    code: 10010,
    message: 'External crypto service for signing with node key URL is not set',
  },
  EXTERNAL_SIGN_MASTER_URL_NOT_SET: {
    code: 10011,
    message: 'External crypto service for signing with node master key URL is not set',
  },
  EXTERNAL_DECRYPT_URL_NOT_SET: {
    code: 10012,
    message: 'External crypto service for decrypting with node key URL is not set',
  },

  // Client errors
  PATH_PARAMS_VALIDATION_FAILED: {
    code: 20001,
    message: 'Path parameters validation failed',
    clientError: true,
  },
  QUERY_STRING_VALIDATION_FAILED: {
    code: 20002,
    message: 'Query string validation failed',
    clientError: true,
  },
  BODY_VALIDATION_FAILED: {
    code: 20003,
    message: 'Body validation failed',
    clientError: true,
  },
  IDP_LIST_LESS_THAN_MIN_IDP: {
    code: 20004,
    message:
      'Provided IdPs is less than minimum IdP needed (length of "idp_list" is less than "min_idp")',
    clientError: true,
  },
  NO_IDP_FOUND: {
    code: 20005,
    message: 'No IdP found',
    clientError: true,
  },
  NOT_ENOUGH_IDP: {
    code: 20006,
    message:
      'Not enough IdP (the number of IdPs found is less than minimum IdP needed)',
    clientError: true,
  },
  BODY_PARSE_FAILED: {
    code: 20007,
    message: 'Unable to parse body',
  },
  EXTERNAL_SIGN_TEST_FAILED: {
    code: 20008,
    message: 'External service: Sign with node key test failed',
  },
  EXTERNAL_SIGN_MASTER_TEST_FAILED: {
    code: 20009,
    message: 'External service: Sign with node master key test failed',
  },
  EXTERNAL_DECRYPT_TEST_FAILED: {
    code: 20010,
    message: 'External service: Decrypt with node key test failed',
  },

  // Errors return from ABCI app
  // Server errors
  ENCODING_ERROR: {
    code: 15001,
    message: 'Error encoding',
  },
  DECODING_ERROR: {
    code: 15002,
    message: 'Error decoding transaction in base64 format',
  },
  BAD_NONCE: {
    code: 15003,
    message: 'Bad nonce',
  },
  UNMARSHAL_ERROR: {
    code: 15004,
    message: 'Cannot unmarshal JSON',
  },
  MARSHAL_ERROR: {
    code: 15005,
    message: 'Cannot marshal JSON',
  },
  WRONG_TRANSACTION_FORMAT: {
    code: 15006,
    message: 'Wrong transaction format',
  },
  METHOD_CAN_NOT_BE_EMPTY: {
    code: 15007,
    message: 'Method name cannot be empty',
  },
  DUPLICATE_REQUEST_ID: {
    code: 15008,
    message: 'Duplicate request ID',
  }, // Server generates a duplicate request ID

  // Client errors
  REQUEST_ID_NOT_FOUND: {
    code: 25001,
    message: 'Request ID not found',
    clientError: true,
  },
  REQUEST_IS_CLOSED: {
    code: 25002,
    message: 'Request is already closed',
    clientError: true,
  },
  REQUEST_IS_TIMED_OUT: {
    code: 25003,
    message: 'Request is already timed out',
    clientError: true,
  },
  REQUEST_IS_COMPLETED: {
    code: 25004,
    message: 'Request is already completed',
    clientError: true,
  },
  DUPLICATE_SERVICE_ID: {
    code: 25005,
    message: 'Duplicate service ID',
    clientError: true,
  },
  TOKEN_ACCOUNT_NOT_FOUND: {
    code: 25006,
    message: 'Token account (Node ID) not found',
    clientError: true,
  },
  NOT_ENOUGH_TOKEN: {
    code: 25007,
    message: 'Not enough token to make a transaction',
    clientError: true,
  },
  DUPLICATE_RESPONSE: {
    code: 25008,
    message: 'Duplicate response',
    clientError: true,
  },
  AAL_ERROR: {
    code: 25009,
    message: "Response's AAL is less than required minimum AAL",
    clientError: true,
  },
  IAL_ERROR: {
    code: 25010,
    message: "Response's IAL is less than required minimum IAL",
    clientError: true,
  },
  DUPLICATE_NODE_ID: {
    code: 25011,
    message: 'Duplicate Node ID',
    clientError: true,
  },
  WRONG_ROLE: {
    code: 25012,
    message: 'Invalid role',
    clientError: true,
  },
  DUPLICATE_NAMESPACE: {
    code: 25013,
    message: 'Duplicate namespace',
    clientError: true,
  },
  NAMESPACE_NOT_FOUND: {
    code: 25014,
    message: 'Namespace not found',
    clientError: true,
  },
  NODE_ID_NOT_FOUND: {
    code: 25015,
    message: 'Node ID not found',
    clientError: true,
  },
  DUPLICATE_PUBLIC_KEY: {
    code: 25016,
    message: 'Duplicate public key (already used)',
    clientError: true,
  },

  UNAUTHORIZED: {
    code: 35001,
    message:
      'Unauthorized (You may have not registered your node with NDID or calling a function with a wrong role)',
  },
};
