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

import errorType from 'ndid-error/type';

// Response codes from ABCI app
// OK                                                 uint32 = 0
// EncodingError                                      uint32 = 1
// DecodingError                                      uint32 = 2
// BadNonce                                           uint32 = 3
// Unauthorized                                       uint32 = 4
// UnmarshalError                                     uint32 = 5
// MarshalError                                       uint32 = 6
// RequestIDNotFound                                  uint32 = 7
// RequestIsClosed                                    uint32 = 8
// RequestIsTimedOut                                  uint32 = 9
// RequestIsCompleted                                 uint32 = 10
// DuplicateServiceID                                 uint32 = 11
// TokenAccountNotFound                               uint32 = 12
// TokenNotEnough                                     uint32 = 13
// InvalidTransactionFormat                           uint32 = 14
// MethodCanNotBeEmpty                                uint32 = 15
// DuplicateResponse                                  uint32 = 16
// AALError                                           uint32 = 17
// IALError                                           uint32 = 18
// DuplicateNodeID                                    uint32 = 19
// WrongRole                                          uint32 = 20
// DuplicateNamespace                                 uint32 = 21
// NamespaceNotFound                                  uint32 = 22
// DuplicateRequestID                                 uint32 = 23
// NodeIDNotFound                                     uint32 = 24
// DuplicatePublicKey                                 uint32 = 25
// DuplicateAccessorID                                uint32 = 26
// DuplicateAccessorGroupID                           uint32 = 27
// AccessorGroupIDNotFound                            uint32 = 28
// RequestIsNotCompleted                              uint32 = 29
// RequestIsNotSpecial                                uint32 = 30
// InvalidMinIdp                                      uint32 = 31
// NodeIDDoesNotExistInASList                         uint32 = 32
// AsIDDoesNotExistInASList                           uint32 = 33
// ServiceIDNotFound                                  uint32 = 34
// InvalidMode                                        uint32 = 35
// HashIDNotFound                                     uint32 = 36
// DuplicateASInDataRequest                           uint32 = 39
// DuplicateAnsweredAsIDList                          uint32 = 40
// DuplicateServiceIDInDataRequest                    uint32 = 41
// ServiceDestinationNotFound                         uint32 = 42
// DataRequestIsCompleted                             uint32 = 43
// NotFirstIdP                                        uint32 = 44
// AccessorIDNotFound                                 uint32 = 45
// NotOwnerOfAccessor                                 uint32 = 46
// NoPermissionForRegisterServiceDestination          uint32 = 47
// IncompleteValidList                                uint32 = 48
// UnknownMethod                                      uint32 = 49
// InvalidKeyFormat                                   uint32 = 50
// UnsupportedKeyType                                 uint32 = 51
// UnknownKeyType                                     uint32 = 52
// NDIDisAlreadyExisted                               uint32 = 53
// NoPermissionForSetMqAddresses                      uint32 = 54
// NoPermissionForCallNDIDMethod                      uint32 = 55
// NoPermissionForCallIdPMethod                       uint32 = 56
// NoPermissionForCallASMethod                        uint32 = 57
// NoPermissionForCallRPandIdPMethod                  uint32 = 58
// VerifySignatureError                               uint32 = 59
// NotOwnerOfRequest                                  uint32 = 60
// CannotGetPublicKeyFromParam                        uint32 = 61
// CannotGetMasterPublicKeyFromNodeID                 uint32 = 62
// CannotGetPublicKeyFromNodeID                       uint32 = 63
// TimeOutBlockIsMustGreaterThanZero                  uint32 = 64
// RSAKeyLengthTooShort                               uint32 = 65
// RegisterIdentityIsTimedOut                         uint32 = 66
// AmountMustBeGreaterOrEqualToZero                   uint32 = 67
// NodeIsNotActive                                    uint32 = 68
// ServiceIsNotActive                                 uint32 = 69
// ServiceDestinationIsNotActive                      uint32 = 70
// ServiceDestinationIsNotApprovedByNDID              uint32 = 71
// NodeIDIsAlreadyAssociatedWithProxyNode             uint32 = 72
// NodeIDisProxyNode                                  uint32 = 73
// NodeIDHasNotBeenAssociatedWithProxyNode            uint32 = 74
// ProxyNodeNotFound                                  uint32 = 75
// NodeIDDoesNotExistInIdPList                        uint32 = 76
// ProxyNodeIsNotActive                               uint32 = 77
// NodeIDInIdPListIsNotActive                         uint32 = 78
// NodeIDInASListIsNotActive                          uint32 = 79
// RoleIsNotAS                                        uint32 = 80
// RequestIsNotClosed                                 uint32 = 81
// ChainIsDisabled                                    uint32 = 82
// ChainIsNotInitialized                              uint32 = 83
// DuplicateNonce                                     uint32 = 84
// NotExistValidator                                  uint32 = 85
// IdentityAlreadyExisted                             uint32 = 86
// IdentityCannotBeEmpty                              uint32 = 87
// GotRefGroupCodeAndIdentity                         uint32 = 88
// RefGroupNotFound                                   uint32 = 89
// IdentityNotFoundInThisIdP                          uint32 = 90
// InvalidPurpose                                     uint32 = 91
// RequestIsAlreadyUsed                               uint32 = 92
// RefGroupCodeCannotBeEmpty                          uint32 = 93
// AllAccessorMustHaveSameRefGroupCode                uint32 = 94
// AccessorNotFoundInThisIdP                          uint32 = 95
// DuplicatedNamespaceInIdentityList                  uint32 = 96
// AccessorIDCannotBeEmpty                            uint32 = 97
// AccessorPublicKeyCannotBeEmpty                     uint32 = 98
// AccessorTypeCannotBeEmpty                          uint32 = 99
// InvalidNamespace                                   uint32 = 100
// IdentifierCountIsGreaterThanAllowedIdentifierCount uint32 = 101
// IalMustBeGreaterOrEqualMinIal                      uint32 = 102
// CannotRevokeAllAccessorsInThisIdP                  uint32 = 103
// DuplicateIdentifier                                uint32 = 104
// NewModeListMustBeHigherThanCurrentModeList         uint32 = 105
// InvalidErrorCode                                   uint32 = 106
// NodeNotInWhitelist                                 uint32 = 107
// AppStateError                                      uint32 = 108
// RequestCannotBeFulfilled                           uint32 = 109
// DataRequestCannotBeFulfilled                       uint32 = 110
// IdPCreateRequestWithDataRequestNotAllowed          uint32 = 111
// IdPCreateRequestMode1And2NotAllowed                uint32 = 112
// ServicePriceCeilingListNotFound                    uint32 = 113
// ServicePriceCeilingNotFound                        uint32 = 114
// ServiceMaxPriceGreaterThanPriceCeiling             uint32 = 115
// ServicePriceEffectiveDatetimeBeforeAllowed         uint32 = 116
// ServicePriceMinCannotBeGreaterThanMax              uint32 = 117
// NothingToUpdateIdentity                            uint32 = 118
// NoPermissionForCallRPMethod                        uint32 = 119
// DuplicateMessageID                                 uint32 = 120
// RequestTypeAlreadyExists                           uint32 = 121
// RequestTypeDoesNotExist                            uint32 = 122
// UnknownError                                       uint32 = 999

const codeMapping = {
  1: errorType.ABCI_ENCODING_ERROR, // Not used in API (calls from API won't generate this error)
  2: errorType.ABCI_DECODING_ERROR, // Cannot base64 decode transaction
  3: errorType.ABCI_BAD_NONCE,
  4: errorType.ABCI_UNAUTHORIZED,
  5: errorType.ABCI_UNMARSHAL_ERROR,
  6: errorType.ABCI_MARSHAL_ERROR,
  7: errorType.ABCI_REQUEST_ID_NOT_FOUND,
  8: errorType.ABCI_REQUEST_IS_CLOSED,
  9: errorType.ABCI_REQUEST_IS_TIMED_OUT,
  10: errorType.ABCI_REQUEST_IS_COMPLETED,
  11: errorType.ABCI_DUPLICATE_SERVICE_ID,
  12: errorType.ABCI_TOKEN_ACCOUNT_NOT_FOUND, // Node ID not found
  13: errorType.ABCI_NOT_ENOUGH_TOKEN,
  14: errorType.ABCI_WRONG_TRANSACTION_FORMAT,
  15: errorType.ABCI_METHOD_CAN_NOT_BE_EMPTY,
  16: errorType.ABCI_DUPLICATE_RESPONSE,
  17: errorType.ABCI_AAL_ERROR,
  18: errorType.ABCI_IAL_ERROR,
  19: errorType.ABCI_DUPLICATE_NODE_ID,
  20: errorType.ABCI_WRONG_ROLE,
  21: errorType.ABCI_DUPLICATE_NAMESPACE,
  22: errorType.ABCI_NAMESPACE_NOT_FOUND,
  23: errorType.ABCI_DUPLICATE_REQUEST_ID,
  24: errorType.ABCI_NODE_ID_NOT_FOUND,
  25: errorType.ABCI_DUPLICATE_PUBLIC_KEY,
  26: errorType.ABCI_DUPLICATE_ACCESSOR_ID,
  27: errorType.ABCI_DUPLICATE_ACCESSOR_GROUP_ID,
  28: errorType.ABCI_ACCESSOR_GROUP_ID_NOT_FOUND,
  29: errorType.ABCI_REQUEST_IS_NOT_COMPLETED,
  30: errorType.ABCI_INVALID_REQUEST_PURPOSE,
  31: errorType.ABCI_INVALID_MIN_IDP,
  32: errorType.ABCI_NODE_ID_DOES_NOT_EXIST_IN_AS_LIST,
  33: errorType.ABCI_AS_ID_DOES_NOT_EXIST_IN_AS_LIST,
  34: errorType.ABCI_SERVICE_ID_NOT_FOUND,
  35: errorType.ABCI_INVALID_MODE,
  36: errorType.ABCI_HASH_ID_NOT_FOUND,
  37: errorType.ABCI_DUPLICATE_IDENTITY_PROOF,
  38: errorType.ABCI_WRONG_IDENTITY_PROOF,
  39: errorType.ABCI_DUPLICATE_AS_IN_DATA_REQUEST,
  40: errorType.ABCI_DUPLICATE_ANSWERED_AS_ID,
  41: errorType.ABCI_DUPLICATE_SERVICE_ID_IN_DATA_REQUEST,
  42: errorType.ABCI_SERVICE_DESTINATION_NOT_FOUND,
  43: errorType.ABCI_DATA_REQUEST_IS_COMPLETED,
  44: errorType.ABCI_NOT_FIRST_IDP,
  45: errorType.ABCI_ACCESSOR_ID_NOT_FOUND,
  46: errorType.ABCI_NOT_OWNER_OF_ACCESSOR,
  47: errorType.ABCI_REGISTER_SERVICE_UNAUTHORIZED,
  48: errorType.ABCI_INCOMPLETE_RESPONSE_VALID_LIST,
  49: errorType.ABCI_UNKNOWN_METHOD,
  50: errorType.ABCI_INVALID_KEY_FORMAT,
  51: errorType.ABCI_UNSUPPORTED_KEY_TYPE,
  52: errorType.ABCI_UNKNOWN_KEY_TYPE,
  53: errorType.ABCI_NDID_ALREADY_EXIST,
  54: errorType.ABCI_NO_PERMISSION_TO_REGISTER_MESSAGE_QUEUE_ADDRESSES,
  55: errorType.ABCI_NO_PERMISSION_TO_CALL_NDID_METHOD,
  56: errorType.ABCI_NO_PERMISSION_TO_CALL_IDP_METHOD,
  57: errorType.ABCI_NO_PERMISSION_TO_CALL_AS_METHOD,
  58: errorType.ABCI_NO_PERMISSION_TO_CALL_RP_AND_IDP_METHOD,
  59: errorType.ABCI_SIGNATURE_VERIFICATION_FAILED,
  60: errorType.ABCI_NOT_REQUEST_OWNER,
  61: errorType.ABCI_CANNOT_GET_PUBLIC_KEY_FROM_PARAMS,
  62: errorType.ABCI_CANNOT_GET_MASTER_PUBLIC_KEY_BY_NODE_ID,
  63: errorType.ABCI_CANNOT_GET_PUBLIC_KEY_BY_NODE_ID,
  64: errorType.ABCI_BLOCK_TIMEOUT_MUST_BE_GREATER_THAN_ZERO,
  65: errorType.ABCI_RSA_KEY_LENGTH_TOO_SHORT,
  66: errorType.ABCI_REGISTER_IDENTITY_TIMED_OUT,
  67: errorType.ABCI_AMOUNT_MUST_BE_GREATER_OR_EQUAL_ZERO,
  68: errorType.ABCI_NODE_IS_NOT_ACTIVE,
  69: errorType.ABCI_SERVICE_IS_NOT_ACTIVE,
  70: errorType.ABCI_SERVICE_DESTINATION_IS_NOT_ACTIVE,
  71: errorType.ABCI_SERVICE_DESTINATION_IS_NOT_APPROVED,
  72: errorType.ABCI_NODE_IS_ALREADY_ASSOCIATED_WITH_PROXY_NODE,
  73: errorType.ABCI_NODE_IS_PROXY_NODE,
  74: errorType.ABCI_NODE_NOT_ASSOCIATED_WITH_PROXY_NODE,
  75: errorType.ABCI_PROXY_NODE_NOT_FOUND,
  76: errorType.ABCI_NODE_ID_DOES_NOT_EXIST_IN_REQUESTED_IDP_LIST,
  77: errorType.ABCI_PROXY_NODE_IS_NOT_ACTIVE,
  78: errorType.ABCI_NODE_ID_IN_IDP_LIST_IS_NOT_ACTIVE,
  79: errorType.ABCI_NODE_ID_IN_AS_LIST_IS_NOT_ACTIVE,
  80: errorType.ABCI_NOT_AS,
  81: errorType.ABCI_REQUEST_IS_NOT_CLOSED,
  82: errorType.ABCI_CHAIN_DISABLED,
  83: errorType.ABCI_CHAIN_NOT_INITIALIZED,
  84: errorType.ABCI_DUPLICATE_NONCE,
  85: errorType.ABCI_VALIDATOR_DOES_NOT_EXIST,
  86: errorType.ABCI_IDENTITY_ALREADY_EXIST,
  87: errorType.ABCI_IDENTITY_CANNOT_BE_EMPTY,
  88: errorType.ABCI_CANNOT_INPUT_BOTH_REF_GROUP_CODE_AND_IDENTITY,
  89: errorType.ABCI_REF_GROUP_NOT_FOUND,
  90: errorType.ABCI_IDENTITY_NOT_FOUND_ON_IDP,
  91: errorType.ABCI_INVALID_REQUEST_PURPOSE,
  92: errorType.ABCI_REQUEST_IS_ALREADY_USED,
  93: errorType.ABCI_REF_GROUP_CODE_CANNOT_BE_EMPTY,
  94: errorType.ABCI_ALL_ACCESSOR_MUST_HAVE_SAME_REF_GROUP_CODE,
  95: errorType.ABCI_ACCESSOR_NOT_FOUND_ON_IDP,
  96: errorType.ABCI_DUPLICATE_NAMESPACE_IN_IDENTITY_LIST,
  97: errorType.ABCI_ACCESSOR_ID_CANNOT_BE_EMPTY,
  98: errorType.ABCI_ACCESSOR_PUBLIC_KEY_CANNOT_BE_EMPTY,
  99: errorType.ABCI_ACCESSOR_TYPE_CANNOT_BE_EMPTY,
  100: errorType.ABCI_INVALID_NAMESPACE,
  101: errorType.ABCI_ALLOWED_IDENTIFIER_COUNT_EXCEEDED,
  102: errorType.ABCI_IAL_TOO_LOW_FOR_FIRST_IDP,
  103: errorType.ABCI_CANNOT_REVOKE_ALL_ACCESSORS_IN_THIS_IDP,
  104: errorType.ABCI_DUPLICATE_IDENTIFIER,
  105: errorType.ABCI_NEW_MODE_LIST_MUST_BE_HIGHER_THAN_CURRENT_MODE_LIST,
  106: errorType.ABCI_INVALID_ERROR_CODE,
  107: errorType.ABCI_NODE_NOT_IN_WHITELIST,
  108: errorType.ABCI_APP_STATE_ERROR,
  109: errorType.ABCI_REQUEST_CANNOT_BE_FULFILLED,
  110: errorType.ABCI_DATA_REQUEST_CANNOT_BE_FULFILLED,
  111: errorType.ABCI_IDP_CREATE_REQUEST_WITH_DATA_REQUEST_NOT_ALLOWED,
  112: errorType.ABCI_IDP_CREATE_REQUEST_MODE_1_AND_2_NOT_ALLOWED,
  113: errorType.ABCI_SERVICE_PRICE_CEILING_LIST_NOT_FOUND,
  114: errorType.ABCI_SERVICE_PRICE_CEILING_NOT_FOUND,
  115: errorType.ABCI_SERVICE_MAX_PRICE_GREATER_THAN_PRICE_CEILING,
  116: errorType.ABCI_SERVICE_PRICE_EFFECTIVE_DATETIME_BEFORE_ALLOWED,
  117: errorType.ABCI_SERVICE_PRICE_MIN_CANNOT_BE_GREATER_THAN_MAX,
  118: errorType.ABCI_NOTHING_TO_UPDATE_IDENTITY,
  119: errorType.ABCI_NO_PERMISSION_TO_CALL_RP_METHOD,
  120: errorType.ABCI_DUPLICATE_MESSAGE_ID,
  121: errorType.ABCI_REQUEST_TYPE_ALREADY_EXISTS,
  122: errorType.ABCI_REQUEST_TYPE_DOES_NOT_EXIST,

  999: errorType.UNKNOWN_ERROR,
};

export function convertAbciAppCodeToErrorType(abciAppCode) {
  return codeMapping[abciAppCode];
}
