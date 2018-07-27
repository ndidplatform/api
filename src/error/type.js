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
  SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET: {
    code: 10013,
    message: 'Sign with accessor key callback URL has not been set',
  },
  SIGN_WITH_ACCESSOR_KEY_FAILED: {
    code: 10014,
    message: 'Cannot sign with accessor key by callback',
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
  EXTERNAL_SIGN_TEST_FAILED: {
    code: 20008,
    message: 'External service: Sign with node key test failed',
    clientError: true,
  },
  EXTERNAL_SIGN_MASTER_TEST_FAILED: {
    code: 20009,
    message: 'External service: Sign with node master key test failed',
    clientError: true,
  },
  EXTERNAL_DECRYPT_TEST_FAILED: {
    code: 20010,
    message: 'External service: Decrypt with node key test failed',
    clientError: true,
  },
  ACCESSOR_PUBLIC_KEY_NOT_FOUND: {
    code: 20011,
    message: 'Accessor public key for the input accessor ID could not be found',
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
    message: 'Already created an idenity for this user',
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
    message: '"min_ial" or "min_aal" too low for some services requested',
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
  INVALID_CIPHER: {
    code: 20027,
    message: 'Invalid cipher suite',
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

  // Errors return from ABCI app
  // Server errors
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
  ABCI_REQUEST_IS_NOT_SPECIAL: {
    code: 15011,
    message: 'Request id not an onboard (special) type',
  }, // Try to add accessor with request that is not an onboard request type
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
    message: "Response's AAL is less than required minimum AAL",
    clientError: true,
  },
  ABCI_IAL_ERROR: {
    code: 25010,
    message: "Response's IAL is less than required minimum IAL",
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
      'Unauthorized to register a service (NDID may have not granted you the right to register this service)',
    clientError: true,
  },

  ABCI_UNAUTHORIZED: {
    code: 35001,
    message:
      'Unauthorized (You may have not registered your node with NDID or calling a function with a wrong role)',
  },
};
