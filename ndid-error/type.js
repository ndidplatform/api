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

module.exports = {
  // Test
  TEST: {
    code: 100,
    message: 'Test error callback',
  },
  // Server errors
  UNKNOWN_ERROR: {
    code: 10000,
    message: 'Unknown Error',
  },
  TENDERMINT_HTTP_CALL_ERROR: {
    code: 10001,
    message: 'Tendermint HTTP RPC call failed',
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
    message:
      'External crypto service for signing with node key URL has not been set',
  },
  EXTERNAL_SIGN_MASTER_URL_NOT_SET: {
    code: 10011,
    message:
      'External crypto service for signing with node master key URL has not been set',
  },
  EXTERNAL_DECRYPT_URL_NOT_SET: {
    code: 10012,
    message:
      'External crypto service for decrypting with node key URL has not been set',
  },
  ENCRYPT_WITH_ACCESSOR_KEY_URL_NOT_SET: {
    code: 10013,
    message: 'Encrypt with accessor key callback URL has not been set',
  },
  ENCRYPT_WITH_ACCESSOR_KEY_FAILED: {
    code: 10014,
    message: 'Cannot encrypt with accessor key by callback',
  },
  INVALID_RESPONSE: {
    code: 10015,
    message: 'Invalid response from IdP (Invalid signature or ZK proof)',
  },
  USER_REJECTED: {
    code: 10016,
    message: 'User has rejected to give a consent',
  },
  REGISTERING_MESSAGE_QUEUE_ADDRESS: {
    code: 10017,
    message: 'Message queue address is being registered',
  },
  MESSAGE_QUEUE_ADDRESS_NOT_FOUND: {
    code: 10018,
    message: 'Message queue destination not found',
  },
  DIFFERENT_ACCESSOR_GROUP_ID: {
    code: 10019,
    message: 'Conflicted accessor group ID',
  },
  MESSAGE_FROM_UNKNOWN_NODE: {
    code: 10020,
    message: 'Received message from unknown node',
  },
  INVALID_MESSAGE_SIGNATURE: {
    code: 10021,
    message: 'Invalid message signature',
  },
  DECRYPT_MESSAGE_ERROR: {
    code: 10022,
    message: 'Error decrypting message received from message queue',
  },
  MALFORMED_MESSAGE_FORMAT: {
    code: 10023,
    message: 'Malformed message format from message queue',
  },
  INVALID_RESPONSES: {
    code: 10024,
    message:
      'One or more responses from IdP are invalid (Invalid signature or ZK proof)',
  },
  REQUEST_INTEGRITY_CHECK_FAILED: {
    code: 10025,
    message: 'Request integrity check failed',
  },
  LOADING_EXPECTED_TXS_CACHE: {
    code: 10026,
    message: 'Loading expected transactions from cache DB',
  },
  WRONG_MESSAGE_QUEUE_PROTOCOL: {
    code: 10027,
    message: 'Received unrecognized message via message queue',
  },
  DB_ERROR: {
    code: 10028,
    message: 'Database error',
  },
  WAITING_FOR_DPKI_CALLBACK_URL_SET: {
    code: 10029,
    message: 'Waiting for DPKI callback URLs to be set',
  },
  CANNOT_WRITE_CALLBACK_URL_TO_FILE: {
    code: 10030,
    message: 'Cannot write callback url to file',
  },
  CANNOT_READ_CALLBACK_URL_FROM_FILE: {
    code: 10031,
    message: 'Cannot read callback url from file',
  },
  NODE_INFO_NOT_FOUND: {
    code: 10032,
    message: 'Node info could not be found',
  },
  INVALID_DATA_RESPONSE_SIGNATURE: {
    code: 10033,
    message: 'Invalid data response from AS (Invalid signature)',
  },
  NODE_KEY_NOT_FOUND: {
    code: 10034,
    message: 'Key could not be found. May need to re-initialize node keys.',
  },
  CANNOT_PARSE_DATA: {
    code: 10035,
    message: 'Cannot parse data string to JSON',
  },
  CANNOT_GET_DATA_SCHEMA: {
    code: 10036,
    message: 'Cannot get data schema from blockchain',
  },
  CANNOT_VALIDATE_DATA: {
    code: 10037,
    message: 'Cannot validate AS data response',
  },
  MQ_SEND_ERROR: {
    code: 10038,
    message: 'Message queue (sender) error',
  },
  MQ_RECV_ERROR: {
    code: 10039,
    message: 'Message queue (receiver) error',
  },
  MQ_SEND_CLEANUP_ERROR: {
    code: 10040,
    message: 'Message queue (sender) clean up error',
  },
  MQ_SEND_TIMEOUT: {
    code: 10041,
    message: 'Message queue send retry timed out. Give up sending.',
  },
  MQ_SEND_ACK_UNKNOWN_MESSAGE_ID: {
    code: 10042,
    message: 'Cannot send ACK for unknown message ID',
  },
  INVALID_MESSAGE_TYPE: {
    code: 10043,
    message: 'Invalid message type',
  },
  INVALID_MESSAGE_SCHEMA: {
    code: 10044,
    message: 'Invalid message schema',
  },
  CANNOT_VALIDATE_MESSAGE: {
    code: 10045,
    message: 'Cannot validate MQ message',
  },
  CANNOT_SAVE_TRANSACT_REQUEST_FOR_RETRY: {
    code: 10046,
    message:
      'Cannot save transact request for retry later on blockchain disabled',
  },
  UNRECOGNIZED_MESSAGE_CHAIN_ID: {
    code: 10047,
    message: 'Received message from MQ with unrecognized chain ID',
  },
  TENDERMINT_HTTP_CALL_UNEXPECTED_RESULT: {
    code: 10048,
    message: 'Tendermint HTTP RPC call got unexpected result',
  },
  TENDERMINT_MEMPOOL_FULL: {
    code: 10049,
    message: 'Tendermint mempool is full',
  },
  NO_MODE_AVAILABLE: {
    code: 10050,
    message: 'No mode available',
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
      'Provided IdP list is less than minimum IdP needed (length of "idp_id_list" is less than "min_idp")',
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
    clientError: true,
  },
  EXTERNAL_SIGN_TEST_FAILED_NO_PUB_KEY: {
    code: 20008,
    message:
      'External service: Sign with node key test failed. Node public key could not be found. This node may have not been registered with NDID.',
    clientError: true,
  },
  EXTERNAL_MASTER_SIGN_TEST_FAILED_NO_PUB_KEY: {
    code: 20009,
    message:
      'External service: Sign with node master key test failed. Node master public key could not be found. This node may have not been registered with NDID.',
    clientError: true,
  },
  EXTERNAL_DECRYPT_TEST_FAILED_NO_PUB_KEY: {
    code: 20010,
    message:
      'External service: Decrypt with node key test failed. Node public key could not be found. This node may have not been registered with NDID.',
    clientError: true,
  },
  ACCESSOR_PUBLIC_KEY_NOT_FOUND_OR_NOT_ACTIVE: {
    code: 20011,
    message:
      'Accessor public key for the input accessor ID could not be found or inactive',
    clientError: true,
  },
  REQUEST_NOT_FOUND: {
    code: 20012,
    message: 'Request ID could not be found',
    clientError: true,
  },
  INVALID_NAMESPACE: {
    code: 20013,
    message: 'This namespace is not registered by NDID',
    clientError: true,
  },
  ACCESSOR_ID_NEEDED: {
    code: 20014,
    message: '"accessor_id" is required for mode 3',
    clientError: true,
  },
  SECRET_NEEDED: {
    code: 20015,
    message: '"secret" is required for mode 3',
    clientError: true,
  },
  IDP_ID_LIST_NEEDED: {
    code: 20016,
    message: '"idp_id_list" is required for mode 1',
    clientError: true,
  },
  AS_LIST_LESS_THAN_MIN_AS: {
    code: 20017,
    message:
      'Provided AS list is less than minimum AS needed (length of "as_id_list" is less than "min_as")',
    clientError: true,
  },
  DUPLICATE_SERVICE_ID: {
    code: 20018,
    message: 'Duplicate service ID in data request list',
    clientError: true,
  },
  IDENTITY_ALREADY_CREATED: {
    code: 20019,
    message: 'Already created an identity for this user',
    clientError: true,
  },
  IDENTITY_NOT_FOUND: {
    code: 20020,
    message:
      'An identity for this user could not be found. It may have not been created yet',
    clientError: true,
  },
  MAXIMUM_IAL_EXCEED: {
    code: 20021,
    message: 'Specified ial exceeds maximum ial capability',
    clientError: true,
  },
  CONDITION_TOO_LOW: {
    code: 20022,
    message:
      'Minimum AS in some services requested cannot be met with some conditions (due to required "min_ial", "min_aal" or "namespace")',
    clientError: true,
  },
  MISSING_ARGUMENTS: {
    code: 20023,
    message: 'Some arguments is missing',
  },
  NOT_ENOUGH_AS: {
    code: 20024,
    message:
      'Not enough AS (the number of AS offer the service is less than minimum AS needed)',
    clientError: true,
  },
  REQUEST_IS_CLOSED: {
    code: 20025,
    message: 'Request is already closed',
    clientError: true,
  },
  REQUEST_IS_TIMED_OUT: {
    code: 20026,
    message: 'Request is already timed out',
    clientError: true,
  },
  INVALID_SECRET: {
    code: 20027,
    message: 'Invalid secret',
    clientError: true,
  },
  INVALID_ACCESSOR_SIGNATURE: {
    code: 20028,
    message: 'Invalid accessor signature',
    clientError: true,
  },
  MALFORMED_SECRET_FORMAT: {
    code: 20029,
    message: 'Malformed secret format',
    clientError: true,
  },
  DUPLICATE_ACCESSOR_ID: {
    code: 20030,
    message: 'Duplicate accessor ID',
    clientError: true,
  },
  NO_INCOMING_REQUEST: {
    code: 20031,
    message:
      'Request could not be found / This node has not received the request from message queue',
    clientError: true,
  },
  INVALID_HTTP_RESPONSE_STATUS_CODE: {
    code: 20032,
    message: 'Invalid HTTP response status code',
    clientError: true,
  },
  CANNOT_PARSE_JSON: {
    code: 20033,
    message: 'Cannot parse string to JSON',
    clientError: true,
  },
  MISSING_DATA_IN_AS_DATA_RESPONSE: {
    code: 20034,
    message: 'Missing data in AS data response',
    clientError: true,
  },
  INVALID_DATA_TYPE_IN_AS_DATA_RESPONSE: {
    code: 20035,
    message: 'Invalid data type in AS data response. Expected string.',
    clientError: true,
  },
  BODY_TOO_LARGE: {
    code: 20036,
    message: 'Body size is too large (greater than limit)',
    clientError: true,
  },
  UNKNOWN_DATA_REQUEST: {
    code: 20037,
    message:
      'Unknown data request (This node may has not yet received data request from RP or the request does not concern this node)',
    clientError: true,
  },
  UNKNOWN_CONSENT_REQUEST: {
    code: 20038,
    message:
      'Unknown consent request (This node may has not yet received consent request from RP or the request does not concern this node)',
    clientError: true,
  },
  SERVICE_ID_NOT_FOUND_IN_REQUEST: {
    code: 20039,
    message:
      'Service ID could not be found in data request list of the request',
    clientError: true,
  },
  INVALID_KEY_FORMAT: {
    code: 20040,
    message: 'Invalid or malformed key format',
    clientError: true,
  },
  UNSUPPORTED_KEY_TYPE: {
    code: 20041,
    message: 'Unsupported key type. Only RSA is allowed.',
    clientError: true,
  },
  MISMATCHED_KEY_TYPE: {
    code: 20042,
    message:
      'Key type mismatched. Provided key type does not match with given key.',
    clientError: true,
  },
  SOME_AS_DO_NOT_PROVIDE_SERVICE: {
    code: 20043,
    message:
      'Some AS IDs in some services in data request list do not provide the requested service',
    clientError: true,
  },
  RSA_KEY_LENGTH_TOO_SHORT: {
    code: 20044,
    message: 'RSA key length is too short. Must be at least 2048-bit.',
    clientError: true,
  },
  DUPLICATE_REFERENCE_ID: {
    code: 20045,
    message: 'Request for this reference ID is in progress',
    clientError: true,
  },
  EXTERNAL_DECRYPT_TEST_FAILED_MESSAGE_MISMATCH: {
    code: 20046,
    message: 'External service: Receive mismatched message after decrypt',
    clientError: true,
  },
  EXTERNAL_DECRYPT_TEST_FAILED_CONNECTIVITY_ERROR: {
    code: 20047,
    message:
      'External service: Cannot connect to external decrypt service or receive malform response',
    clientError: true,
  },
  EXTERNAL_DECRYPT_TEST_FAILED_JSON_PARSING_ERROR: {
    code: 20048,
    message: 'External service: Cannot parse JSON response',
    clientError: true,
  },
  EXTERNAL_SIGN_TEST_FAILED_INVALID_SIGNATURE: {
    code: 20049,
    message: 'External service: Receive invalid signature',
    clientError: true,
  },
  EXTERNAL_SIGN_TEST_FAILED_CONNECTIVITY_ERROR: {
    code: 20050,
    message:
      'External service: Cannot connect to external sign service or receive malform response',
    clientError: true,
  },
  EXTERNAL_SIGN_TEST_FAILED_JSON_PARSING_ERROR: {
    code: 20051,
    message: 'External service: Cannot parse JSON response',
    clientError: true,
  },
  EXTERNAL_MASTER_SIGN_TEST_FAILED_INVALID_SIGNATURE: {
    code: 20052,
    message: 'External service: Receive invalid signature for master',
    clientError: true,
  },
  EXTERNAL_MASTER_SIGN_TEST_FAILED_CONNECTIVITY_ERROR: {
    code: 20053,
    message:
      'External service: Cannot connect to external master sign service or receive malform response',
    clientError: true,
  },
  EXTERNAL_MASTER_SIGN_TEST_FAILED_JSON_PARSING_ERROR: {
    code: 20054,
    message: 'External service: Cannot parse JSON response',
    clientError: true,
  },
  IAL_IS_LESS_THAN_REQUEST_MIN_IAL: {
    code: 20055,
    message: "IAL is less than request's minimum IAL",
    clientError: true,
  },
  AAL_IS_LESS_THAN_REQUEST_MIN_AAL: {
    code: 20056,
    message: "AAL is less than request's minimum AAL",
    clientError: true,
  },
  MISSING_NODE_ID: {
    code: 20057,
    message: 'Node ID must be provided',
    clientError: true,
  },
  UNQUALIFIED_IDP: {
    code: 20058,
    message:
      'Some IdP IDs in requested IdP ID list are unqualified to response',
    clientError: true,
  },
  UNQUALIFIED_AS: {
    code: 20058,
    message:
      'Some AS IDs in some services in data request list are unqualified to release data',
    clientError: true,
  },
  DATA_VALIDATION_FAILED: {
    code: 20059,
    message: 'Data validation failed',
    clientError: true,
  },
  WRONG_IAL: {
    code: 20060,
    message: 'Mismatched ial between response and identity info',
    clientError: true,
  },
  INVALID_ACCESSOR_RESPONSE: {
    // TODO: Remove this
    code: 20061,
    message: 'Revoking accessor mismatch with responding accessor',
    clientError: true,
  },
  NOT_OWNER_OF_ACCESSOR: {
    code: 20062,
    message: 'Cannot revoke accessor of other IDP',
    clientError: true,
  },
  UPDATE_NODE_KEY_CHECK_FAILED: {
    code: 20063,
    message: 'Signed check string mismatched',
    clientError: true,
  },
  UPDATE_MASTER_KEY_CHECK_FAILED: {
    code: 20064,
    message: 'Master signed check string mismatched',
    clientError: true,
  },
  IDENTITY_MODE_MISMATCH: {
    code: 20065,
    message: 'This request must be responsed by identity onboarded in mode 3',
    clientError: true,
  },
  UNSUPPORTED_MODE: {
    code: 20066,
    message: 'This request mode is not supported',
    clientError: true,
  },
  MISSING_IDENTITY_ARGUMENT_TO_MERGE: {
    code: 20067,
    message:
      'Missing identity argument ("merge_to_namespace" or "merge_to_identifier") to merge',
    clientError: true,
  },
  IDENTITY_TO_MERGE_TO_DOES_NOT_EXIST: {
    code: 20068,
    message: 'Identity to merge to does not exist',
    clientError: true,
  },
  MULTIPLE_REFERENCE_GROUP_IN_IDENTITY_LIST: {
    code: 20069,
    message: 'Multiple reference group in identity list',
    clientError: true,
  },

  // Errors return from ABCI app
  // Server errors
  ABCI_UNKNOWN_ERROR: {
    code: 15000,
    message: 'Unknown Error',
  },
  ABCI_ENCODING_ERROR: {
    code: 15001,
    message: 'Error encoding',
  },
  ABCI_DECODING_ERROR: {
    code: 15002,
    message: 'Error decoding transaction in base64 format',
  },
  ABCI_BAD_NONCE: {
    code: 15003,
    message: 'Bad nonce',
  },
  ABCI_UNMARSHAL_ERROR: {
    code: 15004,
    message: 'Cannot unmarshal JSON',
  },
  ABCI_MARSHAL_ERROR: {
    code: 15005,
    message: 'Cannot marshal JSON',
  },
  ABCI_WRONG_TRANSACTION_FORMAT: {
    code: 15006,
    message: 'Wrong transaction format',
  },
  ABCI_METHOD_CAN_NOT_BE_EMPTY: {
    code: 15007,
    message: 'Method name cannot be empty',
  },
  ABCI_DUPLICATE_REQUEST_ID: {
    code: 15008,
    message: 'Duplicate request ID',
  }, // Server generates a duplicate request ID
  ABCI_ACCESSOR_GROUP_ID_NOT_FOUND: {
    code: 15009,
    message: 'Accessor group ID could not be found',
  },
  ABCI_REQUEST_IS_NOT_COMPLETED: {
    code: 15010,
    message: 'Request is not completed',
  }, // Try to add accessor when request for consent id not yet completed
  ABCI_INVALID_REQUEST_PURPOSE: {
    code: 15011,
    message: 'Invalid request purpose',
  }, // e.g. try to add accessor with request that is not a create identity request type
  ABCI_NODE_ID_DOES_NOT_EXIST_IN_AS_LIST: {
    code: 15012,
    message: 'Node ID does not exist in AS ID list',
  }, // AS signs data to request that does not request it
  ABCI_AS_ID_DOES_NOT_EXIST_IN_AS_LIST: {
    code: 15013,
    message: 'AS ID does not exist in AS ID list',
  }, // RP set received data with AS ID that does not contain in data_request_list
  ABCI_INVALID_MIN_IDP: {
    code: 15014,
    message: 'Invalid minimum IdP',
  },
  ABCI_DUPLICATE_ACCESSOR_GROUP_ID: {
    code: 15015,
    message: 'Duplicate accessor group ID',
  },
  ABCI_DUPLICATE_IDENTITY_PROOF: {
    code: 15016,
    message: 'Duplicate identity proof',
  },
  ABCI_WRONG_IDENTITY_PROOF: {
    code: 15017,
    message: 'Wrong identity proof',
  },
  ABCI_NOT_FIRST_IDP: {
    code: 15018,
    message:
      'Cannot register message queue destination for identity as the first IdP',
  },
  ABCI_INCOMPLETE_RESPONSE_VALID_LIST: {
    code: 15019,
    message: 'Incomplete IdP response valid list',
  },
  ABCI_UNKNOWN_METHOD: {
    code: 15020,
    message: 'Unknown method',
  },
  ABCI_REGISTER_IDENTITY_TIMED_OUT: {
    code: 15021,
    message: 'Identity registration is timed out',
  },
  ABCI_NODE_IS_NOT_ACTIVE: {
    code: 15022,
    message: 'Node is disabled',
  },
  ABCI_SERVICE_IS_NOT_ACTIVE: {
    code: 15023,
    message: 'Service is disabled',
  },
  ABCI_SERVICE_DESTINATION_IS_NOT_ACTIVE: {
    code: 15024,
    message: 'Service destination is disabled',
  },
  ABCI_SERVICE_DESTINATION_IS_NOT_APPROVED: {
    code: 15025,
    message: 'Service destination is not approved or disabled by NDID',
  },
  ABCI_PROXY_NODE_IS_NOT_ACTIVE: {
    code: 15026,
    message: 'Proxy node is disabled',
  },
  ABCI_REQUEST_IS_NOT_CLOSED: {
    code: 15027,
    message: 'Request is not closed',
  },
  ABCI_CHAIN_DISABLED: {
    code: 15028,
    message: 'Blockchain is disabled',
  },
  ABCI_CHAIN_NOT_INITIALIZED: {
    code: 15029,
    message: 'Blockchain is not initialized',
  },
  ABCI_DUPLICATE_NONCE: {
    code: 15030,
    message: 'Duplicate transaction nonce',
  },
  ABCI_REQUEST_IS_ALREADY_USED: {
    code: 15031,
    message: 'Request is already used',
  },

  // Client errors
  ABCI_REQUEST_ID_NOT_FOUND: {
    code: 25001,
    message: 'Request ID could not be found',
    clientError: true,
  },
  ABCI_REQUEST_IS_CLOSED: {
    code: 25002,
    message: 'Request is already closed',
    clientError: true,
  },
  ABCI_REQUEST_IS_TIMED_OUT: {
    code: 25003,
    message: 'Request is already timed out',
    clientError: true,
  },
  ABCI_REQUEST_IS_COMPLETED: {
    code: 25004,
    message: 'Request is already completed',
    clientError: true,
  },
  ABCI_DUPLICATE_SERVICE_ID: {
    code: 25005,
    message: 'Duplicate service ID',
    clientError: true,
  },
  ABCI_TOKEN_ACCOUNT_NOT_FOUND: {
    code: 25006,
    message: 'Token account (Node ID) could not be found',
    clientError: true,
  },
  ABCI_NOT_ENOUGH_TOKEN: {
    code: 25007,
    message: 'Not enough token to make a transaction',
    clientError: true,
  },
  ABCI_DUPLICATE_RESPONSE: {
    code: 25008,
    message: 'Duplicate response',
    clientError: true,
  },
  ABCI_AAL_ERROR: {
    code: 25009,
    message: 'AAL error',
    clientError: true,
  },
  ABCI_IAL_ERROR: {
    code: 25010,
    message: 'IAL error',
    clientError: true,
  },
  ABCI_DUPLICATE_NODE_ID: {
    code: 25011,
    message: 'Duplicate Node ID',
    clientError: true,
  },
  ABCI_WRONG_ROLE: {
    code: 25012,
    message: 'Invalid role',
    clientError: true,
  },
  ABCI_DUPLICATE_NAMESPACE: {
    code: 25013,
    message: 'Duplicate namespace',
    clientError: true,
  },
  ABCI_NAMESPACE_NOT_FOUND: {
    code: 25014,
    message: 'Namespace could not be found',
    clientError: true,
  },
  ABCI_NODE_ID_NOT_FOUND: {
    code: 25015,
    message: 'Node ID could not be found',
    clientError: true,
  },
  ABCI_DUPLICATE_PUBLIC_KEY: {
    code: 25016,
    message: 'Duplicate public key (already used)',
    clientError: true,
  },
  ABCI_DUPLICATE_ACCESSOR_ID: {
    code: 25017,
    message: 'Duplicate accessor ID',
    clientError: true,
  },
  ABCI_SERVICE_ID_NOT_FOUND: {
    code: 25018,
    message: 'Service ID could not be found',
    clientError: true,
  },
  ABCI_INVALID_MODE: {
    code: 25019,
    message: 'Invalid mode',
    clientError: true,
  },
  ABCI_HASH_ID_NOT_FOUND: {
    code: 25020,
    message: 'Hash ID could not be found',
    clientError: true,
  },
  ABCI_DUPLICATE_AS_IN_DATA_REQUEST: {
    code: 25021,
    message: 'Duplicate AS in data request list',
    clientError: true,
  },
  ABCI_DUPLICATE_ANSWERED_AS_ID: {
    code: 25022,
    message: 'Duplicate answered AS ID',
    clientError: true,
  },
  ABCI_DUPLICATE_SERVICE_ID_IN_DATA_REQUEST: {
    code: 25023,
    message: 'Duplicate service ID in data request list',
    clientError: true,
  },
  ABCI_SERVICE_DESTINATION_NOT_FOUND: {
    code: 25024,
    message: 'Service destination could not be found',
    clientError: true,
  },
  ABCI_DATA_REQUEST_IS_COMPLETED: {
    code: 25025,
    message: 'Data request is already completed',
    clientError: true,
  }, // AS could not sign data in time
  ABCI_ACCESSOR_ID_NOT_FOUND: {
    code: 25026,
    message: 'Accessor ID could not be found',
    clientError: true,
  },
  ABCI_NOT_OWNER_OF_ACCESSOR: {
    code: 25027,
    message: 'This node is not an owner of this accessor',
    clientError: true,
  },
  ABCI_REGISTER_SERVICE_UNAUTHORIZED: {
    code: 25028,
    message:
      'Unauthorized to register a service (NDID may have not granted this node the right to register this service)',
    clientError: true,
  },
  ABCI_INVALID_KEY_FORMAT: {
    code: 25029,
    message: 'Invalid key format',
    clientError: true,
  },
  ABCI_UNSUPPORTED_KEY_TYPE: {
    code: 25030,
    message: 'Unsupported key type. Only RSA and EC are allowed.',
    clientError: true,
  },
  ABCI_UNKNOWN_KEY_TYPE: {
    code: 25031,
    message: 'Unknown key type',
    clientError: true,
  },
  ABCI_NDID_ALREADY_EXIST: {
    code: 25032,
    message: 'NDID node is already existed',
    clientError: true,
  },
  ABCI_NO_PERMISSION_TO_REGISTER_MESSAGE_QUEUE_ADDRESSES: {
    code: 25033,
    message: 'No permission to register message queue addresses',
    clientError: true,
  },
  ABCI_NO_PERMISSION_TO_CALL_NDID_METHOD: {
    code: 25034,
    message: 'No permission to call NDID method',
    clientError: true,
  },
  ABCI_NO_PERMISSION_TO_CALL_IDP_METHOD: {
    code: 25035,
    message: 'No permission to call IdP method',
    clientError: true,
  },
  ABCI_NO_PERMISSION_TO_CALL_AS_METHOD: {
    code: 25036,
    message: 'No permission to call AS method',
    clientError: true,
  },
  ABCI_NO_PERMISSION_TO_CALL_RP_AND_IDP_METHOD: {
    code: 25037,
    message: 'No permission to call RP and IdP method',
    clientError: true,
  },
  ABCI_SIGNATURE_VERIFICATION_FAILED: {
    code: 25038,
    message: "Node's signature verification failed",
    clientError: true,
  },
  ABCI_NOT_REQUEST_OWNER: {
    code: 25039,
    message: 'Not a request owner',
    clientError: true,
  },
  ABCI_CANNOT_GET_PUBLIC_KEY_FROM_PARAMS: {
    code: 25040,
    message: 'Cannot get public key from parameters',
    clientError: true,
  },
  ABCI_CANNOT_GET_MASTER_PUBLIC_KEY_BY_NODE_ID: {
    code: 25041,
    message: 'Cannot get master public key by node ID',
    clientError: true,
  },
  ABCI_CANNOT_GET_PUBLIC_KEY_BY_NODE_ID: {
    code: 25042,
    message: 'Cannot get public key by node ID',
    clientError: true,
  },
  ABCI_BLOCK_TIMEOUT_MUST_BE_GREATER_THAN_ZERO: {
    code: 25043,
    message:
      'Block timeout for registering message queue destination must be greater than 0',
    clientError: true,
  },
  ABCI_RSA_KEY_LENGTH_TOO_SHORT: {
    code: 25044,
    message: 'RSA key length is too short. Must be at least 2048-bit',
    clientError: true,
  },
  ABCI_AMOUNT_MUST_BE_GREATER_OR_EQUAL_ZERO: {
    code: 25045,
    message: 'Amount must be greater than or equal to 0',
    clientError: true,
  },
  ABCI_NODE_IS_ALREADY_ASSOCIATED_WITH_PROXY_NODE: {
    code: 25046,
    message: 'Node is already associated with a proxy node',
    clientError: true,
  },
  ABCI_NODE_IS_PROXY_NODE: {
    code: 25047,
    message: 'Node is a proxy node',
    clientError: true,
  },
  ABCI_NODE_NOT_ASSOCIATED_WITH_PROXY_NODE: {
    code: 25048,
    message: 'Node is not associated with any proxy node',
    clientError: true,
  },
  ABCI_PROXY_NODE_NOT_FOUND: {
    code: 25049,
    message: 'Proxy node could not be found or does not exist',
    clientError: true,
  },
  ABCI_NODE_ID_DOES_NOT_EXIST_IN_REQUESTED_IDP_LIST: {
    code: 25050,
    message: 'Node ID does not exist in requested IdP list',
    clientError: true,
  },
  ABCI_NODE_ID_IN_IDP_LIST_IS_NOT_ACTIVE: {
    code: 25051,
    message: 'One or more node IDs in requested IdP list are not active',
    clientError: true,
  },
  ABCI_NODE_ID_IN_AS_LIST_IS_NOT_ACTIVE: {
    code: 25052,
    message: 'One or more node IDs in requested service AS list are not active',
    clientError: true,
  },
  ABCI_NOT_AS: {
    code: 25053,
    message: 'This node ID does not belong to AS',
    clientError: true,
  },
  ABCI_VALIDATOR_DOES_NOT_EXIST: {
    code: 25054,
    message: 'Validator does not exist',
    clientError: true,
  },
  ABCI_IDENTITY_ALREADY_EXIST: {
    code: 25055,
    message: 'Identity already exist',
    clientError: true,
  },
  ABCI_IDENTITY_CANNOT_BE_EMPTY: {
    code: 25056,
    message: 'Identity cannot be empty',
    clientError: true,
  },
  ABCI_CANNOT_INPUT_BOTH_REF_GROUP_CODE_AND_IDENTITY: {
    code: 25057,
    message: 'Cannot input both reference group code and identity',
    clientError: true,
  },
  ABCI_REF_GROUP_NOT_FOUND: {
    code: 25058,
    message: 'Reference group code could not be found',
    clientError: true,
  },
  ABCI_IDENTITY_NOT_FOUND_ON_IDP: {
    code: 25059,
    message: 'Identity could not be found on input IdP',
    clientError: true,
  },
  ABCI_REF_GROUP_CODE_CANNOT_BE_EMPTY: {
    code: 25060,
    message: 'Reference group code cannot be empty',
    clientError: true,
  },
  ABCI_ALL_ACCESSOR_MUST_HAVE_SAME_REF_GROUP_CODE: {
    code: 25061,
    message: 'All accessors must have the same reference group code',
    clientError: true,
  },
  ABCI_ACCESSOR_NOT_FOUND_ON_IDP: {
    code: 25062,
    message: 'Accessor could not be found on input IdP',
    clientError: true,
  },
  ABCI_DUPLICATE_NAMESPACE_IN_IDENTITY_LIST: {
    code: 25063,
    message: 'Duplicate namespace in identity list',
    clientError: true,
  },
  ABCI_ACCESSOR_ID_CANNOT_BE_EMPTY: {
    code: 25064,
    message: 'Accessor ID cannot be empty',
    clientError: true,
  },
  ABCI_ACCESSOR_PUBLIC_KEY_CANNOT_BE_EMPTY: {
    code: 25065,
    message: 'Accessor public key cannot be empty',
    clientError: true,
  },
  ABCI_ACCESSOR_TYPE_CANNOT_BE_EMPTY: {
    code: 25066,
    message: 'Accessor type cannot be empty',
    clientError: true,
  },
  ABCI_INVALID_NAMESPACE: {
    code: 25067,
    message: 'Invalid namespace',
    clientError: true,
  },
  ABCI_ALLOWED_IDENTIFIER_COUNT_EXCEEDED: {
    code: 25068,
    message: 'Exceed number of identifier allowed for namespace',
    clientError: true,
  },
  ABCI_IAL_TOO_LOW_FOR_FIRST_IDP: {
    code: 25069,
    message: 'Too low IAL for first IdP',
    clientError: true,
  },

  ABCI_UNAUTHORIZED: {
    code: 35001,
    message:
      'Unauthorized (This node may have not been registered with NDID or calling a function with a wrong role)',
  },
};
