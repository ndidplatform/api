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

const codeMapping = {
  1: errorType.ENCODING_ERROR, // Not used in API (calls from API won't generate this error)
  2: errorType.DECODING_ERROR, // Cannot base64 decode transaction
  3: errorType.BAD_NONCE,
  4: errorType.UNAUTHORIZED,
  5: errorType.UNMARSHAL_ERROR,
  6: errorType.MARSHAL_ERROR,
  7: errorType.REQUEST_ID_NOT_FOUND,
  8: errorType.REQUEST_IS_CLOSED,
  9: errorType.REQUEST_IS_TIMED_OUT,
  10: errorType.REQUEST_IS_COMPLETED,
  11: errorType.DUPLICATE_SERVICE_ID,
  12: errorType.TOKEN_ACCOUNT_NOT_FOUND, // Node ID not found
  13: errorType.NOT_ENOUGH_TOKEN,
  14: errorType.WRONG_TRANSACTION_FORMAT,
  15: errorType.METHOD_CAN_NOT_BE_EMPTY,
  16: errorType.DUPLICATE_RESPONSE,
  17: errorType.AAL_ERROR,
  18: errorType.IAL_ERROR,
  19: errorType.DUPLICATE_NODE_ID,
  20: errorType.WRONG_ROLE,
  21: errorType.DUPLICATE_NAMESPACE,
  22: errorType.NAMESPACE_NOT_FOUND,
  23: errorType.DUPLICATE_REQUEST_ID,
  24: errorType.NODE_ID_NOT_FOUND,
  25: errorType.DUPLICATE_PUBLIC_KEY,
};

export function convertAbciAppCodeToErrorType(abciAppCode) {
  return codeMapping[abciAppCode];
}
