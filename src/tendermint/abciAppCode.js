import errorCode from '../error/code';

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

const codeMapping = {
  1: errorCode.ENCODING_ERROR, // Not used in API (calls from API won't generate this error)
  2: errorCode.DECODING_ERROR, // Cannot base64 decode transaction
  3: errorCode.BAD_NONCE,
  4: errorCode.UNAUTHORIZED,
  5: errorCode.UNMARSHAL_ERROR,
  6: errorCode.MARSHAL_ERROR,
  7: errorCode.REQUEST_ID_NOT_FOUND,
  8: errorCode.REQUEST_IS_CLOSED,
  9: errorCode.REQUEST_IS_TIMED_OUT,
  10: errorCode.REQUEST_IS_COMPLETED,
  11: errorCode.DUPLICATE_SERVICE_ID,
  12: errorCode.TOKEN_ACCOUNT_NOT_FOUND, // Node ID not found
  13: errorCode.NOT_ENOUGH_TOKEN,
  14: errorCode.WRONG_TRANSACTION_FORMAT,
  15: errorCode.METHOD_CAN_NOT_BE_EMPTY,
  16: errorCode.DUPLICATE_RESPONSE,
  17: errorCode.AAL_ERROR,
  18: errorCode.IAL_ERROR,
  19: errorCode.DUPLICATE_NODE_ID,
  20: errorCode.WRONG_ROLE,
  21: errorCode.DUPLICATE_NAMESPACE,
  22: errorCode.NAMESPACE_NOT_FOUND,
  23: errorCode.DUPLICATE_REQUEST_ID,
};

export function convertAbciAppCode(abciAppCode) {
  return codeMapping[abciAppCode];
}
