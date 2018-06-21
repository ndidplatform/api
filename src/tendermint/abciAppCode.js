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

import errorType from '../error/type';

// Response codes from ABCI app
// OK                     uint32 = 0
// EncodingError          uint32 = 1
// DecodingError          uint32 = 2
// BadNonce               uint32 = 3
// Unauthorized           uint32 = 4
// UnmarshalError         uint32 = 5
// MarshalError           uint32 = 6
// RequestIDNotFound      uint32 = 7
// RequestIsClosed        uint32 = 8
// RequestIsTimedOut      uint32 = 9
// RequestIsCompleted     uint32 = 10
// DuplicateServiceID     uint32 = 11
// TokenAccountNotFound   uint32 = 12
// TokenNotEnough         uint32 = 13
// WrongTransactionFormat uint32 = 14
// MethodCanNotBeEmpty    uint32 = 15
// DuplicateResponse      uint32 = 16
// AALError               uint32 = 17
// IALError               uint32 = 18
// DuplicateNodeID        uint32 = 19
// WrongRole              uint32 = 20
// DuplicateNamespace     uint32 = 21
// NamespaceNotFound      uint32 = 22
// DuplicateRequestID     uint32 = 23
// NodeIDNotFound         uint32 = 24
// DuplicatePublicKey     uint32 = 25
// DuplicateAccessorID      uint32 = 26
// DuplicateAccessorGroupID uint32 = 27
// AccessorGroupIDNotFound  uint32 = 28
// RequestIsNotCompleted    uint32 = 29
// RequestIsNotSpecial      uint32 = 30
// InvalidMinIdp            uint32 = 31
// NodeIDIsNotExistInASList uint32 = 32
// AsIDIsNotExistInASList   uint32 = 33
// ServiceIDNotFound        uint32 = 34
// InvalidMode              uint32 = 35

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
  30: errorType.ABCI_REQUEST_IS_NOT_SPECIAL,
  31: errorType.ABCI_INVALID_MIN_IDP,
  32: errorType.ABCI_NODE_ID_DOES_NOT_EXIST_IN_AS_LIST,
  33: errorType.ABCI_AS_ID_DOES_NOT_EXIST_IN_AS_LIST,
  34: errorType.ABCI_SERVICE_ID_NOT_FOUND,
  35: errorType.ABCI_INVALID_MODE,
};

export function convertAbciAppCodeToErrorType(abciAppCode) {
  return codeMapping[abciAppCode];
}
