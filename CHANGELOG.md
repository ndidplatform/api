# Changelog

## TBD

BREAKING CHANGES:

- Change structure of `secret` (remove prepended padding). All `secret` need to be re-calculated.
- Change error type `INVALID_CIPHER` to `INVALID_SECRET`.
- When IdP creates response:
  - `secret` cannot be malformed (since it no longer has form).
  - `secret` will be checked for validity and may return `INVALID_SECRET`.

FEATURES:

- Add GET `/reinit_node_keys` for reading node keys from files again while the server is running.

IMPROVEMENTS:

- Wait for DB (Redis) reconnect when the connection is down before processing received message from MQ.
- Wait for DB (Redis) to connect on server start. (Previously, stop server initialization process if fail to connect on the first try.)
- Group MQ message signing when sending request data from RP to AS. (Reduce message signing if payload is identical.)
- [MQ] Wait for receiver to save raw message to cache DB before sending ACK back to sender.

BUG FIXES:

- Fix data related to a request in cache DB does not get cleared when a request is closed or timed out.
- Fix expected Tx in cache DB does not get cleared when error trying to make a transaction to Tendermint.
- Fix Tendermint new blocks get processed without waiting for node's private key read on server start.
- Fix MQ address check on server start.
- Fix POST `/utility/private_messages/:request_id/housekeeping` does not remove outbound private messages.
- Fix loading MQ duplicate timeouts from cache DB on server start.
- Fix RP able to get data from AS through API GET `/requests/data/:request_id` even when RP cannot set data received (e.g. since the request is closed or timed out).
- Fix server initialization flow.
- Fix race condition when saving genereated challenges by pre-generating challenges for all IdPs on request creation and save once.
- Fix race condition when saving received private proof to cache by changing storing method.

## 0.8.0 (September 23, 2018)

BREAKING CHANGES:

- API version 2.2
  - Remove `request_params` property from `data_request_list` in callback body when notifying incoming request to IdP.
  - Change return body JSON schema for GET `/utility/private_messages/:request_id`
- Switch from using SQLite3 as a database to Redis. Redis server is mandatory to run the server.

FEATURES:

- Proxy node support.
- API version 2.2
  - New APIs: GET `/identity/:namespace/:identifier/ial` Get identity's IAL.
  - Add `request_message` optional property to POST `/identity` and POST `/identity/:namespace/:identifier/accessors`
  - Add `node_id` property to POST body and query string to GET of APIs for proxy node to specify node ID it wants to act on behalf of. This property is ignored if node is not a proxy.
- Support loading environment variables from `.env` file.

IMPROVEMENTS:

- API version 2.2
  - Add `requester_node_id` property to AS service callback data.
  - Add `requester_node_id` property to GET `/utility/requests/:request_id`.
  - Add `request_timeout` property to IdP incoming request callback data.
  - Add `node_id` property to all callbacks. (Note that `/error` callback may not have `node_id` property.)
- Change cache and long-term database to Redis for better performance. This change introduces 3 new environment variables `DB_IP`, `DB_PORT`, and `DB_PASSWORD`.
- Reduce RPC/HTTP query calls to Tendermint.
- Remove `ROLE` environment variable option. The server will get a node's role from blockchain on start. Error if it cannot get node's role from blockchain.
- [Docker] Support protobuf in startup script and remove legacy namespaces. 

BUG FIXES:

- Fix GET `/identity/requests/reference/:reference_id` always return HTTP response 404. (API v2)
- Fix unable to make an IdP response more than once when responding with less than request's minimum IAL and/or AAL the first time (by validating IdP response's IAL and AAL to be greater than or equal to request's minimum IAL and request's minimum AAL respectively).
- Fix error when creating request without `data_request_list` (not set to empty array).
- Fix cached request message data does not get deleted after used on IdP side.
- Fix cached reference ID get removed when create request or create identity with duplicate reference ID.

## 0.7.2 (August 22, 2018)

FEATURES:

- Add `LOG_ONE_LINE` environment variable option for logging in a single line.

IMPROVEMENTS:

- Differentiate external crypto service test errors when setting DPKI callbacks by separating into multiple error types.
- Return HTTP response 503 with correct reason when waiting for DPKI callback URLs to be set (if configured to use external crypto service).
- Change storage for AS service callback URLs from storing in cache DB to write to file in plain text for easier URL change when the process is not running. (NOTE: AS node must run a migration script `change_as_service_callback_url_storage.js` after updating to this version)

BUG FIXES:

- Fix creating signature with master key using external crypto service invalid URL error.

## 0.7.1 (August 16, 2018)

IMPROVEMENTS:

- [Docker] Set umask to 027 and use user nobody to run service
- [Docker] Add security_opt: no-new-priviledges in docker-compose file

## 0.7.0 (August 15, 2018)

BREAKING CHANGES:

- Return error HTTP response 400 instead of returning 202 when creating request on RP side or creating create identity request on IdP side with duplicate reference ID. (Note: Error only when the request of the reference ID is in progress which is when it is not closed or timed out yet).

FEATURES:

- Add new API: GET `/identity/requests/reference/:reference_id` for getting request ID and accessor ID of an unfinished create identity request.
- Validate HTTP request body for NDID APIs.

IMPROVEMENTS:

- Prevent received message loss when external crypto service cannot be contacted (until callback timeout) or Tendermint is not yet ready by retrying processing later and persisting raw message buffer to cache DB and delete it after decryption and signature verification.
- Process Tendermint missing block events after finish syncing without having to wait for the next block.
- Create cache DB tables that are going to be used by role instead of creating all tables for all roles.

## 0.6.2 (August 5, 2018)

IMPROVEMENTS:

- Use ROUTER mode instead of REP mode on the receiving side of message queue (ZeroMQ) to make it an asynchronous server that can talk to multiple REQ clients at the same time. This also fixes process hang when receiving malformed data.
- Validate node's private key and master private key on server start when using private key file (PEM format, RSA type with at least 2048-bit length is allowed).

## 0.6.1 (August 4, 2018)

IMPROVEMENTS:

- API version 2.1
  - Add `creation_time` property in object when calling callback to IdP with type `incoming_request`. The property value is UNIX timestamp of when the request is approximately created. This change also applies to API v1.

BUG FIXES:

- Fix error when emitting an error from MQ module caused by invalid import statement.
- Fix callbacks that have been successfully sent and got too large response body get sending again after server restarts caused by not removing callback metadata from cache DB.
- Fix cannot set timeout to a request that has short timeout caused by a request has not been created on the blockchain in time.
- Fix `request_timeout` can be `0`. Minimum now set to `1`.

## 0.6.0 (August 3, 2018)

BREAKING CHANGES:

- API version 2.1
  - Add `initial_salt` property when responding back to POST `/rp/requests/:namespace/:identifier`. This change also applies to API v1.
  - Add `request_message_salt` property in object when calling callback to IdP with type `incoming_request`. This change also applies to API v1.
  - Add `data_salt` and `signature_sign_method` properties to data from AS when querying on RP side. (GET `/rp/requests/data/:request_id`) This change also applies to API v1.
  - Separate `valid_proof` into `valid_signature` (accessor signature) and `valid_proof` (ZK proof). This change also applies to API v1. Affect the following APIs:
    - RP Callback type `request_status` in property `response_valid_list`
    - GET `/utility/requests/:request_id`
- Change how `request_message_hash` in IdP callback with type `incoming_request` is generated.
- Change expected `signature` sending with POST `/idp/response`. It should be created by encrypting `request_message_hash` given with `incoming_request` callback without padding.
- Remove `ALLOW_DEBUG_API` environment variable option. Debug APIs are available in development mode and inaccessible in production environment.

IMPROVEMENTS:

- API version 2.1, New APIs:
  - GET `/utility/private_messages/:request_id` Get messages received from message queue with specified request ID.
  - POST `/utility/private_messages/housekeeping` Remove all messages received from message queue.
  - POST `/utility/private_messages/:request_id/housekeeping` Remove messages from MQ with specified request ID.
- Save all messages received from message queue to database.
- Use `/broadcast_tx_sync` when making a transaction to Tendermint to allow more than 2 minutes (Tendermint's default `/broadcast_tx_commit` timeout) commit time.
- Support request timeout of more than 2147483647 (or 32-bit integer) milliseconds (>24.8 days). ([#36](https://github.com/ndidplatform/api/issues/36))
- Validate public key (PEM format, RSA type with at least 2048-bit length is allowed).
- Decrease message payload size when sending over message queue by sending as bytes using Protobuf. ([#38](https://github.com/ndidplatform/api/issues/38))
- Decrease message queue receiving size limit to 3.25MB.
- Verify accessor signature when IdP sending a response (calling POST `/idp/response`).
- Update dependencies
  - `source-map-support@^0.5.6`
  - `sqlite3@^4.0.2`
  - `winston@^3.0.0`
  - `winston-daily-rotate-file@^3.3.0`
  - `ws@^5.2.2`

BUG FIXES:

- Append salt to request message before hash instead of prepend.
- Fix AS data response signature is not salted.
- Fix error in `getMessageWithCode()` in CustomError when error cause is undefined.
- Clean up data in cache DB when create request and create identity fails.
- Fix AS can send data response with any request ID and service ID without having to receive the request first.
- Fix IdP can send response with any valid request ID without having to receive the request first.
- Fix process exits on MQ error by handling error events emitted from MQSend and MQRecv.
- Fix miscommunicated error response when RP trying to create a request with AS ID that does not provide the requested service.

## 0.5.5 (August 3, 2018)

BUG FIXES:

- Fix no size limit for callback response body. Set to 3MB. Send error to optional `/as/error` callback on AS side.

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
