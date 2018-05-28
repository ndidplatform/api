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
};
