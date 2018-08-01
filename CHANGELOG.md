# Changelog

## TBD

BREAKING CHANGES:

- API version 2.1
  - Add `request_message_salt` property when responding back to POST `/rp/requests/:namespace/:identifier`. This change also applies to API v1.
  - Add `request_message_salt` property in object when calling callback to IdP with type `incoming_request`. This change also applies to API v1.
  - Add `data_salt` and `signature_sign_method` properties to data from AS when querying on RP side. (GET `/rp/requests/data/:request_id`) This change also applies to API v1.
- Remove `ALLOW_DEBUG_API` environment variable option. Debug APIs are available in development mode and inaccessible in production environment.

IMPROVEMENTS:

- Use `/broadcast_tx_sync` when making a transaction to Tendermint to allow more than 2 minutes (Tendermint's default `/broadcast_tx_commit` timeout) commit time.
- Support request timeout of more than 2147483647 (or 32-bit integer) milliseconds (>24.8 days).
- Validate public key format and type (PEM format, RSA type is allowed).
- Decrease message payload size when sending over message queue by sending as bytes using Protobuf.
- Decrease message queue receiving size limit to 3.25MB.
- Verify accessor signature when IdP sending a response (calling POST `/idp/response`).

BUG FIXES:

- Append salt to request message before hash instead of prepend.
- Fix AS data response signature is not salted.
- Fix error in `getMessageWithCode()` in CustomError when error cause is undefined.
- Clean up data in cache DB when create request and create identity fails.
- Fix AS can send data response with any request ID and service ID without having to receive the request first.
- Fix IdP can send response with any valid request ID without having to receive the request first.
- Fix process exits on MQ error by handling error events emitted from MQSend and MQRecv.
- Fix miscommunicated error response when RP trying to create a request with AS ID that does not provide the requested service.

## 0.5.4 (July 27, 2018)

IMPROVEMENTS:

- Separate body too large error into another error type.
- Increase API body size limit to 3MB.
- Increase message queue receiving size limit to 5.25MB.

## 0.5.3 (July 22, 2018)

IMPROVEMENTS:

- Remove unnecessary block results query call to Tendermint.
- Cache block information for the latest height block and the one before that in memory to decrease HTTP call to Tendermint.
- Check for app hash when receiving new block event to decrease unnecessary processing (in case Tendermint consensus config for `create_empty_block` is set to true).
- External crypto service callback retry.
- Check for response status and errors when receiving data response from calling callback to AS.
- Add new API for NDID POST `/updateNode` for updating node's `node_name`, `max_ial`, and `max_aal`.

BUG FIXES:

- Fix block height range to handle message when there are missing new block events.
- Change block and block results query calls to Tendermint to use HTTP instead of WebSocket.
- Fix duplicate message processing by removing cache when message is going to be process from handle message from message queue function.
- Fix accessor ID and public key check when creating IdP response in mode 3.
- Fix message queue socket is open when role is set to `ndid`. (It should not open a MQ socket).

## 0.5.2 (July 17, 2018)

BUG FIXES:

- Fix incorrect async event process locks.
- Fix sendRequestToAS() on RP side to send a request to AS only once with all services' data request.
- Fix data request processing on AS side to accept multiple services' data request in one message/request.
- Fix unnecessary message signing when there is no destination to send.

## 0.5.1 (July 16, 2018)

IMPROVEMENTS:

- Log HTTP response status and body as a debug log in development environment.

## 0.5.0 (July 16, 2018)

BREAKING CHANGES:

- Revert to support Tendermint 0.22 (RPC spec changes).

BUG FIXES:

- Fix latest block height seen check after asynchronously save data to cache DB.
- Fix cache data removing logic for expected IdP public proof.

## 0.4.1 (July 15, 2018)

BUG FIXES:

- Fix event race condition in many cases when receiving new block event while processing message from message queue.
- Fix request without data request does not automatically close when block height is met while processing IdP response from message queue.
- Various fixes on handling/processing message from message queue.

## 0.4.0 (July 14, 2018)

BREAKING CHANGES:

- POST `/ndid/initNDID` requires both `public_key` and `master_public_key` as arguments.
- Revert to support Tendermint 0.21 (RPC spec changes).

IMPROVEMENTS:

- More robust message queue (wait for acknowledge from receivers, retry if fail to receive ACK)
- Print a detailed error for the whole stack with easy to read stack trace when logging to console.
- Add POST `/debug/tmQuery/:fnName` and POST `/debug/tmTransact/:fnName` APIs for debugging.

BUG FIXES:

- Fix `accessor_id` is missing from accessor sign callback body when using API v2.
- Fix saving data to cache DB flow in handleMessageFromQueue() to prevent event race condition.

## 0.3.3 (July 12, 2018)

BUG FIXES:

- Fix check `secret` format even in mode 1 when creating IdP response.
- Fix a request in mode 1 does not automatically close when completed.

## 0.3.2 (July 11, 2018)

BUG FIXES:

- Fix error when calling some APIs with version path prefix.
- Add missing callback data property (`accessor_id`) when reporting create identity request result and add accessor request result.

## 0.3.1 (July 11, 2018)

IMPROVEMENTS:

- Verify signature from signing with accessor key before making any transaction to the blockchain.
- Update `bignum` dependency to support Node.js 10.
- Send `block_height` along with request status when calling a callback to RP to let the client app knows which event comes first.
- Throw a more meaningful error when there is an error processing received message from message queue.

BUG FIXES:

- Fix accessor sign check to expect signature according to the standard ([RFC 3447 section 9.2](https://tools.ietf.org/html/rfc3447#section-9.2)).
- Change message format sending over message queue to fix error when there is `|` character in a message payload.
- Fix requests in mode 1 imply `valid_proof` and `valid_ial` as true.
- Fix a request auto close even when response's proof and IAL is not valid. The fixed behavior is auto close only when the request is completed and all IdP responses are valid.
- Fix create identity request related cached data do not get cleaned up after closed.
- Fix unnecessary cache data.
- Change some error throwing to throw CustomError instead of a string.

## 0.3.0 (July 7, 2018)

BREAKING CHANGES:

- API version 2.0
  - All APIs which make transactions to blockchain are now asynchronous. `callback_url` and `reference_id` are required in the request body.
    - POST `/as/service/:service_id`
    - POST `/as/data/:request_id/:service_id`
    - POST `/dpki/node/create`
    - POST `/dpki/node/update`
    - POST `/identity`
    - POST `/identity/:namespace/:identifier/ial`
    - POST `/identity/:namespace/:identifier/accessors`
    - POST `/identity/requests/close`
    - POST `/idp/response`
    - POST `/rp/requests/:namespace/:identifier`
    - POST `/rp/requests/close`
  - Path names change.
    - POST `/dpki/node/register_callback` and POST `/dpki/node/register_callback_master` get combined to POST `/dpki/node/callback`
  - New utility API for querying node's information. (GET `/utility/nodes/:node_id`)
- API version 1.1 is available with path prefix `/v1`.
- Support Tendermint 0.22 (RPC spec changes).

IMPROVEMENTS:

- Configurable auto message queue address registering at server startup. Can be set with `REGISTER_MQ_AT_STARTUP` environment variable.
- Check for different registered message queue address and configured message queue address before setting it to the blockchain. (If the address is the same as the one in the blockchain, the server will not make a transaction to set the address)
- Add more logging for callback (HTTP response code, callback ID).
- Add logging for DPKI (external crypto service) callback.
- Configurable log level. Can be set with `LOG_LEVEL` environment variable.
- Configurable log target. Can be set with `LOG_TARGET` environment variable.
- Configurable log highlight color (enabled/disabled). Can be set with `LOG_COLOR` environment variable.
- [Docker] Support Tendermint 0.22.0

BUG FIXES:

- Change RPC parameter message format sending to Tendermint to fix error when there is `|` character in a message.
- Fix wrong callback `type` value when create identity failed (user does not give a consent or got an invalid response from IdP).
- Fix API path name colision resulting in making `requests` and `housekeeping` reserved words (cannot be used as a namespace).
- Fix create identity requests do not get closed automatically.
- Fix multiple accessor groups get created for the same user when more than one IdP trying to create an identity as the first IdP at the same time.
- Fix returning response body content is HTML when getting an invalid API path request with methods other than GET.

## 0.2.1 (July 3, 2018)

BUG FIXES:

- Fix destructure variables error when IdP message queue address is not found.
- Change public encrypt and private decrypt padding scheme. (Default(PKCS#1 OAEP) to PKCS#1 v1.5).
- Add missing value for accessorSign callback (type, padding) and fix sign_method
- [Docker] Fix issue which incorrectly set master public key as empty string when register a new node

## 0.2.0 (June 30, 2018)

BREAKING CHANGES:

- API version 1.1
- POST `/idp/response` is now asynchronous. `callback_url` is required in a request body.

IMPROVEMENTS:

- [CircleCI] Add a configuration for automatic test, build, and deploy image to dockerhub. ([#23](https://github.com/ndidplatform/api/pull/23))
- Configurable callback retry timeout. The config only applies to some callbacks. Can be set with `CALLBACK_RETRY_TIMEOUT` environment variable. Accept number in seconds. ([#25](https://github.com/ndidplatform/api/issues/25))
- Handle error when IdP sending a response to a closed or timed out request. Send back a correct error code/message. ([#29](https://github.com/ndidplatform/api/issues/29))
- [Docker] Improve building efficiency in Dockerfile
- [Docker] Use node keypair and master keypair paths from env PRIVATE_KEY_PATH, MASTER_PRIVATE_KEY_PATH, PUBLIC_KEY_PATH, and MASTER_PRIVATE_KEY_PATH
- [Docker] Improve robustness of docker startup script

BUG FIXES:

- Fix GET `/utility/requests/:request_id` response with error 500 when `request_id` does not exist. ([#19](https://github.com/ndidplatform/api/issues/19))
- Fix creating identity request final status stuck at "pending". ([#20](https://github.com/ndidplatform/api/issues/20))
- Fix GET `/as/service/:service_id` response with a wrong format. ([#21](https://github.com/ndidplatform/api/issues/21))
- Fix a request without data request does not close automatically when its status is "completed". ([#22](https://github.com/ndidplatform/api/issues/22))
- Fix GET `/utility/as/:service_id` does not return status 404 when `service_id` does not exist. ([#24](https://github.com/ndidplatform/api/issues/24))
- Fix IdP queries rp_id to send privateProof and got null. ([#26](https://github.com/ndidplatform/api/issues/26))
- Fix duplicate IdP ID in response_valid_list in request status callback to RP. ([#27](https://github.com/ndidplatform/api/issues/27)) ([#28](https://github.com/ndidplatform/api/issues/28))

## 0.1.0 (June 24, 2018)

Initial release of NDID API
