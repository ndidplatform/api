export default {
  // Server error
  UNKNOWN_ERROR: 'Unknown Error',
  TENDERMINT_HTTP_CALL_ERROR: 'Cannot connect to tendermint HTTP endpoint',
  TENDERMINT_QUERY_JSON_RPC_ERROR: 'Tendermint JSON-RPC call error (query)',
  TENDERMINT_QUERY_ERROR: 'Tendermint query failed',
  TENDERMINT_QUERY_RESULT_JSON_PARSE_ERROR:
    'Cannot parse Tendermint query result JSON',
  TENDERMINT_TRANSACT_JSON_RPC_ERROR:
    'Tendermint JSON-RPC call error (transact)',
  TENDERMINT_TRANSACT_ERROR: 'Tendermint query failed',
  TENDERMINT_SYNCING: 'Syncing blockchain data. Please try again later.',
  TENDERMINT_NOT_CONNECTED:
    'Not connected to Tendermint. Please try again later.',

  // Client error
  PATH_PARAMS_VALIDATION_FAILED: 'Path parameters validation failed',
  QUERY_STRING_VALIDATION_FAILED: 'Query string validation failed',
  BODY_VALIDATION_FAILED: 'Body validation failed',
  IDP_LIST_LESS_THAN_MIN_IDP:
    'Provided IdPs is less than minimum IdP needed (length of "idp_list" is less than "min_idp")',
  NO_IDP_FOUND: 'No IdP found',
  NOT_ENOUGH_IDP:
    'Not enough IdP (the number of IdPs found is less than minimum IdP needed)',

  // Errors return from ABCI app
  // Server error
  ENCODING_ERROR: 'Error encoding',
  DECODING_ERROR: 'Error decoding transaction in base64 format',
  BAD_NONCE: 'Bad nonce',
  UNAUTHORIZED: 'Unauthorized',
  UNMARSHAL_ERROR: 'Cannot unmarshal JSON',
  MARSHAL_ERROR: 'Cannot marshal JSON',
  WRONG_TRANSACTION_FORMAT: 'Wrong transaction format',
  METHOD_CAN_NOT_BE_EMPTY: 'Method name cannot be empty',
  DUPLICATE_REQUEST_ID: 'Duplicate request ID', // Server generates a duplicate request ID

  // Client error
  REQUEST_ID_NOT_FOUND: 'Request ID not found',
  REQUEST_IS_CLOSED: 'Request is already closed',
  REQUEST_IS_TIMED_OUT: 'Request is already timed out',
  REQUEST_IS_COMPLETED: 'Request is already completed',
  DUPLICATE_SERVICE_ID: 'Duplicate service ID',
  TOKEN_ACCOUNT_NOT_FOUND: 'Token account (Node ID) not found',
  NOT_ENOUGH_TOKEN: 'Not enough token to make a transaction',
  DUPLICATE_RESPONSE: 'Duplicate response',
  AAL_ERROR: 'AAL error',
  IAL_ERROR: 'IAL error',
  DUPLICATE_NODE_ID: 'Duplicate Node ID',
  WRONG_ROLE: 'Invalid role',
  DUPLICATE_NAMESPACE: 'Duplicate namespace',
  NAMESPACE_NOT_FOUND: 'Namespace not found',
};
