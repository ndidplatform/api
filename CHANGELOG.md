# Changelog

## TBD

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v5.x.x_

IMPROVEMENTS:

- [Main] Add new environment variable options for RP role
  - `AUTO_CLOSE_REQUEST_ON_COMPLETED`: Automatically close a request as soon as status is `completed` (and when all IdP response signatures are valid in mode 2 and 3). Default to `true`.
  - `AUTO_CLOSE_REQUEST_ON_REJECTED`: Automatically close a request as soon as status is `rejected` (and when all IdP response signatures are valid in mode 2 and 3). Default to `false`.
  - `AUTO_CLOSE_REQUEST_ON_COMPLICATED`: Automatically close a request as soon as status is `complicated` (and when all IdP response signatures are valid in mode 2 and 3). Default to `false`.
  - `AUTO_CLOSE_REQUEST_ON_ERRORED`: Automatically close a request as soon as status is `errored`. Default to `false`.

BUG FIXES:

- Requests with `errored` status will not be automatically closed by default to make it conforms with API v4 flow.
- Fix process queue start trigger in request process queue manager.
- Fix error when creating request with non-existent RP node ID (by proxy).

## 4.0.1 (May 20, 2020)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v5.x.x_

BUG FIXES:

- Fix wrong `api_version` (latest API spec version) reported on GET `/info`.
- Fix error when creating request with non-existent IdP node IDs.
- Fix API path names to match spec.
- Fix missing proxy API paths.

## 4.0.0 (May 7, 2020)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v5.x.x_

BREAKING CHANGES:

- API v5.0
  - New API: POST `/idp/error_response` for IdP to response with error to a request.
  - New API: POST `/as/error/:request_id/:service_id` for AS to response with error to a data request.
  - New API: GET `/utility/idp_error_codes` for getting possible IdP error codes.
  - New API: GET `/utility/as_error_codes` for getting possible AS error codes.
  - Change AS callback result `type` for sending data API (POST `/as/data/:request_id/:service_id`) from `send_data_result` to `response_result`.
  - Change body JSON schema of request status update callback API (type: `request_status`) on RP, IdP, and AS to make it more similar to utility get request info and status API (GET `/utility/requests/:request_id`).
    - Remove `answered_idp_count`
    - Remove `service_list`
    - Remove `response_valid_list`
    - Add `response_list`
    - Add `data_request_list`
    - Add `min_ial`
    - Add `min_aal`
    - Add `idp_id_list`
    - Add `request_timeout`
    - Add `request_message_hash`
    - Add `requester_node_id`
  - Add `error_code` to response body of AS data request callback for synchronous error response.
  - Add `agent` (boolean) flag to response body of GET `/utility/idp`.
  - Add query string parameter `filter_for_node_id` to GET `/utility/idp` and GET `/utility/idp/:namespace/:identifier` for getting IdP list filtered with input node ID's whitelist (only if whitelist is enabled).
  - Change response body JSON schema of GET `/utility/request/:request_id`.
    - Add `error_code` to `response_list` item.
    - Remove `answered_as_id_list` and `received_data_from_list` from `data_request_list` item.
    - Add `response_list` with properties `as_id`, `signed`, `received_data`, and `error_code` to `data_request_list` item.
  - Change response body JSON schema of GET `/utility/nodes/:node_id`.
    - Add `agent` (boolean) flag indicating if node is an IdP agent.
    - Add `node_id_whitelist`: array of other node IDs allowed to interact (e.g. create request) with node
    - Add `node_id_whitelist_active` (boolean) flag indicating if `node_id_whitelist` is enabled for node.

IMPROVEMENTS:

- Support Node.js 12.
- Support Tendermint 0.33 (Block result spec change).
- [Main] Add new environment variable options
  - `DEFAULT_API_VERSION`: API version to serve on default path (without version path prefix)
  - `CALLBACK_API_VERSION`: Callback API version
- [Docker] Change Node.js version used in images from 10 to 12.

BUG FIXES:

- Fix verifying response signature error when input signature cannot be decrypt due to data too large for key modulus. Now correctly return false.

## 3.0.1 (November 21, 2019)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v4.x.x_

BUG FIXES:

- Fix does not use all websocket connections in connection pool.

## 3.0.0 (August 1, 2019)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v4.x.x_

BREAKING CHANGES:

- Remove API v3.
- API v4.0
  - `signature` is required for POST `/idp/response`.
  - Remove accessor encrypt callback (mode 2, 3) and sign callback (mode 1) when IdP creating response.
  - New API: GET `/idp/request_message_padded_hash` for getting `request_message_padded_hash` used for creating mode 2 and 3 request signature (signed with accessor private key without padding) on response.
  - Change API route names
    - `/identity/:namespace/:identifier/accessors_revoke` to `/identity/:namespace/:identifier/accessor_revoke`
    - `/identity/:namespace/:identifier/accessors_revoke_and_add` to `/identity/:namespace/:identifier/accessor_revoke_and_add`
  - Change NDID APIs (`/ndid/update_node`, `/ndid/enable_node`, and  `/ndid/disable_node`) HTTP success response status code from 200 to 204.

IMPROVEMENTS:

- API v4.0
  - New callback for notifying message queue message send success (ACK from destination node received). Callback URL can be set using POST `/node/callback` with property `message_queue_send_success_url`.
- Add accessor in request reference group validation on IdP responses.
- Support Tendermint 0.32 (Block result spec change).
- [Docker] Reduce image size.
- [Docker] Remove default owner and permission settings.
- [Docker] Remove `TERM` env.
- [Docker-API] Add docker-entrypoint.sh as image entrypoint which will check existence and owner of `DATA_DIRECTORY_PATH`.

BUG FIXES:

- Fix missing request status update callback (request closed, request timed out) on IdP side for identity related requests.
- Fix invalid IdP response signature check on RP and IdP nodes when signature is cryptographically valid but signed with accessor that is not in request reference group.

OTHERS:

- [Docker] Remove `jq` and `curl` from docker image.

NOTES:

- [Docker] Docker container may be run with `-u` or `--user` flag (e.g. `-u 65534:65534`). In case you are using docker-compose, `user` may be specified in docker-compose file (e.g. `user: 65534:65534`) (see [Compose file reference](https://docs.docker.com/compose/compose-file/#domainname-hostname-ipc-mac_address-privileged-read_only-shm_size-stdin_open-tty-user-working_dir) for more detail).
- [Docker-API] When running docker container with non-root user, source directories that will be mounted into the container as `DATA_DIRECTORY_PATH` must be created beforehand with the non-root user as owner.

## 2.0.1 (June 24, 2019)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v3.0.0_

BUG FIXES:

- Fix incorrect `request_params_hash` when `request_params` is provided.

## 2.0.0 (May 29, 2019)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v3.0.0_

There are a number of significant changes in this release. Some of major changes:

- Introduces mode 2 which is closely similar to mode 3 but without the need for consent request when modifying identity (e.g. create identity/onboarding, add/revoke accessor) on the platform, instead IdPs will get notifications on what kind of modification of which identity has occured on the platform.
- Support for multiple namespaces+identifiers or SIDs as a single identity called reference group.
- API version 1 and 2 have been removed as they are not compatible with multiple SIDs, new mode 2 and 3 flows and other changes such as supported namespaces declared by AS for each service.
- Changes to API route names to fix route collision issues for example, `/rp/requests/housekeeping/data` has been changed to `/rp/request_data_removal` since it collides with `/rp/requests/:namespace/:identifier`.
- Load balancing support for high request throughput.
- Changes to logging.
- Prometheus support.

BREAKING CHANGES:

- Remove API v1.
- Remove API v2.
- API v3.
  - Route changes
    - POST `/rp/requests/housekeeping/data/:request_id` to `/rp/request_data_removal/:request_id`
    - POST `/rp/requests/housekeeping/data` to `/rp/request_data_removal`
    - GET `/rp/requests/reference/:reference_id` to `/rp/request_references/:reference_id`
    - GET `/rp/requests/data/:request_id` to `/rp/request_data/:request_id`
    - POST `/rp/requests/close` to `/rp/request_close`
    - GET `/identity/requests/reference/:reference_id` to `/identity_request/request_references/:reference_id`
    - POST `/identity/requests/close` to `/identity_request/request_close`
    - POST `/utility/private_messages/housekeeping` to `/utility/private_message_removal`
    - POST `/utility/private_messages/:request_id/housekeeping` to `/utility/private_message_removal/:request_id`
    - POST `/dpki/node/create` to `/node/create`
    - POST `/dpki/node/update` to `/node/update`
    - GET `/dpki/node/callback` to `/node/callback`
    - POST `/dpki/node/callback` to `/node/callback`
    - Change all NDID only routes to simple function names in `snake_case` and use only `POST`
      - `/ndid/initNDID` to `/ndid/init_ndid`
      - `/ndid/endInit` to `/ndid/end_init`
      - `/ndid/setAllowedModeList` to `/ndid/set_allowed_mode_list`
      - `/ndid/registerNode` to `/ndid/register_node`
      - `/ndid/updateNode` to `/ndid/update_node`
      - `/ndid/enableNode` to `/ndid/enable_node`
      - `/ndid/disableNode` to `/ndid/disable_node`
      - `/ndid/setNodeToken` to `/ndid/set_node_token`
      - `/ndid/addNodeToken` to `/ndid/add_node_token`
      - `/ndid/reduceNodeToken` to `/ndid/reduce_node_token`
      - `/ndid/namespaces` to `/ndid/create_namespace`
      - `/ndid/namespaces/:namespace` to `/ndid/update_namespace`
      - `/ndid/namespaces/:namespace/enable` to `/ndid/enable_namespace`
      - `/ndid/namespaces/:namespace/disable` to `/ndid/disable_namespace`
      - `/ndid/services` to `/ndid/create_service`
      - `/ndid/services/:service_id` to `/ndid/update_service`
      - `/ndid/services/:service_id/enable` to `/ndid/enable_service`
      - `/ndid/services/:service_id/disable` to `/ndid/disable_service`
      - `/ndid/validator` to `/ndid/set_validator`
      - `/ndid/approveService` to `/ndid/approve_service`
      - `/ndid/enableServiceDestination` to `/ndid/enable_service_destination`
      - `/ndid/disableServiceDestination` to `/ndid/disable_service_destination`
      - `/ndid/addNodeToProxyNode` to `/ndid/add_node_to_proxy_node`
      - `/ndid/updateNodeProxyNode` to `/ndid/update_node_proxy_node`
      - `/ndid/removeNodeFromProxyNode` to `/ndid/remove_node_from_proxy_node`
      - `/ndid/setLastBlock` to `/ndid/set_last_block`
      - GET `/ndid/allowedMinIalForRegisterIdentityAtFirstIdp` to POST `/ndid/get_allowed_min_ial_for_register_identity_at_first_idp`
      - `/ndid/setAllowedMinIalForRegisterIdentityAtFirstIdp` to `/ndid/set_allowed_min_ial_for_register_identity_at_first_idp`
  - Change return JSON property names to `snake_case` on GET `/info`.
  - Change `request_message` value type of DPKI sign callback from plain text string to base64 encoded data string
  - Add `reference_group_code` property in IdP request callback (for requests in mode 2 and 3).
  - Remove `namespace` and `identifier` properties in IdP request callback (for requests in mode 2 and 3).
  - Remove `valid_proof` property in `response_valid_list` from request status update callback.
  - Remove `valid_proof`, `identity_proof`, and `private_proof_hash` properties in `response_list` from GET `/utility/requests/:request_id`.
  - Add `supported_namespace_list` required property to POST `/as/service/:service_id`.
  - Add `supported_namespace_list` property to GET `/as/service/:service_id`.
  - Add `supported_namespace_list` property to GET `/utility/as/:service_id`.
  - Add `reference_group_code` property to create identity result callback when successfully created identity to the platform.
  - Remove `secret` property from create identity result callback when successfully created identity to the platform.
  - Remove `signature` required property from POST `/idp/response`.
  - Change success response code of GET `/identity/:namespace/:identifier` to `200` with `reference_group_code` property in response body.
  - Remove accessor sign callback.
- Move `/ndid` to API v3 router.
- Mode 1 IdP response `signature` will be obtained by signing a request message with node's key, calling node sign callback when using external crypto service.
- Identity modifications in mode 3 no longer create consent request when it is not necessary, resulting in no callback with type `*_request_result` e.g. `create_identity_request_result`.
- Change mode 2 and 3 request response accessor signing scheme.
- Change logging format.
- Remove logging to file feature.
- Remove logging environment variable options
  - `LOG_FORMAT`
  - `LOG_TARGET`: Always log to `stdout`. Logging to file should be done with piping stdout to file or other service (e.g. syslog) and optionally using `logrotate` for log rotation.
  - `LOG_ONE_LINE`: Set `LOG_PRETTY_PRINT` to `false` instead. Log will be in one-line JSON format.
  - `LOG_DIRECTORY_PATH`
- Add logging environment variable option
  - `LOG_PRETTY_PRINT`: Default to `true` in development (`NODE_ENV` not set or set to `development`), `false` otherwise. If not set to `true`, log will be in JSON format.
- Change allowed `LOG_LEVEL` option values to `fatal`, `error`, `warn`, `info`, `debug` and `trace`.
- Change MQ message protocol format
  - Change message ID type from int64 to string.
  - Add message type.
  - Add message version.
- Remove request message for identity operations (which needs consent request) templates. `request_message` is always required when consent request is needed.

IMPROVEMENTS:

- Mode 2 support.
  - Requests
  - Identity creation and modifications e.g. add/revoke accessor
  - Identity modification notification.
- API v3
  - Support `request_message` in data URL format (depends on destination IdPs).
  - Add `supported_request_message_data_url_type_list` property to POST `/node/update` for IdPs.
  - Add `supported_request_message_data_url_type_list` property to GET `/utility/nodes/:node_id` for IdP nodes.
  - Add `supported_request_message_data_url_type_list` property to GET `/utility/idp`.
  - Add `supported_request_message_data_url_type_list` and `mode_list` properties to GET `/utility/idp/:namespace/:identifier`.
  - Add identity-IdP association revocation support (opposite of create identity).
  - New callback for notifying identity modifications (for mode 2 and 3 on IdPs).
  - New callback for encrypt with accessor key (for mode 2 and 3 on IdPs).
- Use UUIDv4 when auto generating accessor IDs.
- Load balancing support by setting `MODE` to `master` on one process and `worker` on other processes with the same Node ID.
- Refactor request process flow.
- Refactor comitted Txs check.
- Add Prometheus support.
- Add new environment variable options
  - `PROMETHEUS`: Enable prometheus metrics and HTTP server for querying metrics
  - `PROMETHEUS_SERVER_PORT`: HTTP server port for querying Prometheus metrics
  - `PROMETHEUS_HTTPS`: Use HTTPS server for Prometheus metrics HTTP server
  - `PROMETHEUS_HTTPS_KEY_PATH`: HTTPS private key file path for Prometheus metrics HTTP server. Required when PROMETHEUS_HTTPS=true
  - `PROMETHEUS_HTTPS_CERT_PATH`: HTTPS certificate file path for Prometheus metrics HTTP server. Required when PROMETHEUS_HTTPS=true
- [Main] Add new environment variable options
  - `MODE`: Allowed values are `standalone`, `master`, and `worker`. There can be only one `master` process per Node ID
  - `MASTER_SERVER_IP`: Master process gRPC server IP address. Required when MODE=master
  - `MASTER_SERVER_PORT`: Master process gRPC server port. Required when MODE=master and MODE=worker
  - `GRPC_EXPECTED_CLIENT_PING_INTERVAL_MS`: gRPC expected client ping interval in milliseconds. Used by `master` mode process. Must be less than `GRPC_PING_INTERVAL_MS` config on worker processes.
  - `CALL_TO_MASTER_RETRY_TIMEOUT_MS`: gRPC call from worker process to master process retry timeout in milliseconds
- Use `scan` stream instead of `keys` for redis operations.
- Use `unlink` (if available - redis 4 or later) instead of `del` for redis delete by key operations.
- Add error callback when error occurs at MQ.
- Reduce MQ message size if `request_message` is in data URL format with base64 encoded data when sending request from RP to IdP.
- Reduce MQ message size if `data` is in data URL format with base64 encoded data when AS send data response back to RP.
- gRPC SSL connection support.

BUG FIXES:

- Fix redis function wrappers logic.
- Fix cache data manipulation on detecting new chain (migrate).
- Fix incorrect socket returned by Tendermint WebSocket pool `getConnection()`.
- [MQ Service] Fix memory leak caused by incomplete clean up.

## 1.0.2 (February 8, 2019)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v1.0.0-v2.0.0_

IMPROVEMENTS:

- [Main] Add new environment variable options
  - `GRPC_PING_INTERVAL_MS`: gRPC ping interval in milliseconds
  - `GRPC_PING_TIMEOUT_MS`: gRPC ping timeout in milliseconds
  - `GRPC_CALL_TIMEOUT_MS`: gRPC call timeout in milliseconds
- [MQ Service] Add new environment variable options
  - `GRPC_PING_INTERVAL_MS`: gRPC ping interval in milliseconds
  - `GRPC_PING_TIMEOUT_MS`: gRPC ping timeout in milliseconds
  - `GRPC_EXPECTED_CLIENT_PING_INTERVAL_MS`: gRPC expected client ping interval in milliseconds. Must be less than `GRPC_PING_INTERVAL_MS` config on API main server pair.
- Set time limit (deadline) for gRPC function calls
  - 10 minutes + 1 minute (default) for `sendMessage()` (equals to total retry timeout for MQ message sending with additional 1 minute)
  - 1 minute (default) for `sendAckForRecvMessage()`

BUG FIXES:

- Fix duplicate AS data response from MQ handling on RP side when a handling happens without waiting for block.

## 1.0.1 (January 24, 2019)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v1.0.0-v2.0.0_

IMPROVEMENTS:

- [MQ Service] Add new environment variable options
  - `MAX_CONCURRENT_MESSAGES_PER_MQ_SOCKET`: Maximum concurrent messages for each MQ sending socket
  - `MAX_MQ_SOCKET`: Configurable maximum sockets for MQ (mitigate `No file descriptors available` error).
- Changed all RPC calls from using HTTP to WebSocket for better performance (decreases response time).
- [Main] Add new environment variable option `TENDERMINT_WS_CONNECTIONS` for configuring number of Tendermint RPC WebSocket connections in connection pool.
- Add APIs for getting server metrics.
  - `/num_expected_txs`: Number of expected Txs (waiting to be included in a block)
  - `/expected_txs`: Array of hashes of expected Tx
  - `/num_pending_outbound_mq_messages`: Number of outbound MQ messages that have not been ACKed by destinations
  - `/num_pending_client_callbacks`: Number of callbacks to client waiting to be sent (includes retries)
  - `/num_pending_external_crypto_callbacks`: Number of callbacks to external crypto service waiting to be sent (includes retries)
  - `/num_processing_blocks`: Number of processing blocks
  - `/processing_blocks`: Array of processing block heights in string (e.g. `51-63`, `99`)
  - `/num_processing_inbound_messages`: Number of processing inbound MQ messages

BUG FIXES:

- Fix `resumeTimeoutScheduler` on server initialization being called too early.
- Change ZeroMQ socket type on sender side from `req` to `dealer`.
- Fix clean up method for mapping (socket, socket-destination) in MQ.
- Clean up for all socket with same `msgId` when receive ack for one `seqId`.
- Rollback ZeroMQ JS library from 5.1 to 4.6 since 5.1 causes segmentation fault error in C binding.
- Fix memory leak when making a gRPC call to MQ service server.

## 1.0.0 (December 7, 2018)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v1.0.0-v2.0.0_

IMPROVEMENTS:

- Reuse MQ connection when possible if there are multiple send message calls and the destination IP and port are the same.

BUG FIXES:

- Fix Tendermint sync/catch up status polling does not continue when got no result from HTTP RPC call.
- Remove both chain ID and latest block height files first when handling new chain function is called to prevent invalid value in latest block height file in case the server stops before it is able to write a block height of a new chain.

## 0.12.1 (November 21, 2018)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v0.13.0_

BUG FIXES:

- Fix check `chain_id` logic when recieve MQ
- Fix error from checking chain history when new chain ID is detected.

## 0.12.0 (November 21, 2018)

_Compatible with: [`smart-contract`](https://github.com/ndidplatform/smart-contract) v0.13.0_

BREAKING CHANGES:

- Support Tendermint 0.26 (Tx hash spec change).
- Remove `SKIP_GET_ROLE` environment variable option. Add `NDID_NODE` environment variable option for skipping get role and wait for blockchain initialization to end.

IMPROVEMENTS:

- Support Node.js 10.
- [Docker] Change Node.js version used in images from 8 to 10.
- Add `chain_id` in every message sending through message queue.
- Check `chain_id` when receiving message from message queue.
- Add `chain_history_info` in `initNDID`.

BUG FIXES:

- Fix load and retry backlog transact requests is called when server initialization failed.
- Wait for blockchain initialization to end on server start.
- Fix request timeout is called before blockchain initialization ended while migrating to a new chain.
- Fix NDID node cannot be started if blockchain initialization is not ended.
- Fix Tendermint status polling stops when there is an error.
- Handle HTTP response status other than 2xx from Tendermint HTTP RPC call.

## 0.11.4 (November 12, 2018)

BUG FIXES:

- Fix unable to receive MQ message types `consent_request` and `data_request` when `request_message` is an empty string. (Fix wrong message schema validation)
- Fix wrong `request_params_hash` calculation when `request_params` is not provided.
- Remove constraint `minLength` for `request_params` in `service_data_request_list` in inbound MQ message type `data_request` schema.
- Fix `block_height` in request status update to current block height instead of creation block height.
- Fix GET `/utility/services/:service_id` error when requested `service_id` does not exist.

## 0.11.3 (November 12, 2018)

IMPROVEMENTS:

- API version 2.4
  - New API: GET `/utility/services/:service_id`. Get service info including its data schema and data schema version.

BUG FIXES:

- Fix unable to receive MQ message type `data_request` without `request_params` in `service_data_request_list`. (Fix wrong message schema validation)

## 0.11.2 (November 12, 2018)

BUG FIXES:

- Fix wrong data schema returned from calling GET `/utility/requests/:request_id`. (`creation_block_height` type and format, Remove `creation_chain_id`)

## 0.11.1 (November 11, 2018)

BUG FIXES:

- Fix transactions do not get saved for retry when chain is disabled error is returned after commit to blockchain.
- Retry timeout request if chain is disabled.
- Save latest block height to file along with chain ID on fresh start.
- Remove DB password logging on server start.

## 0.11.0 (November 8, 2018)

BREAKING CHANGES:

- Separate MQ module from main server process into another process to provide more flexible deployment strategies.
  - MQ service server must be run together with its main server pair and their `NODE_ID` config must be the same.

IMPROVEMENTS:

- API version 2.4
  - New API: POST `/identity/:namespace/:identifier/accessors_revoke`. Revoke identity's accessor.
  - Add `incoming_request_status_update_url` optional property to POST `/idp/callback` and POST `/as/callback` for setting callback URL for receiving related request status updates. The data schema of the callback body is the same as request update callback on RP side.
  - Change all `block_height` and `creation_block_height` properties format from block height as integer to `<CHAIN_ID>:<BLOCK_HEIGHT>` as string.
- NDID only API
  - Add APIs for enabling and disabling node.
  - Add API for setting last block.
- Check IAL when IdP creating a response.
- Check new key when update DPKI key.
- Save pending outbound messages for MQ to cache DB on server graceful shutdown. The server will try to send on next start if the messages do not exceed MQ send total timeout.
- Validate data schema of inbound messages from message queue.
- Chain ID aware
  - Reset last known block height to 0 and update cached data on chain ID change.

BUG FIXES:

- Fix check validity of secret at create response (if invalid, the response will not be stored in blockchain).
- Fix wrong callback result for create identity.
- Fix duplicate AS data signature processing and set data received on RP side.
- Fix bug when `as_id_list` is not provided when creating a request.

## 0.10.2 (October 29, 2018)

BUG FIXES:

- Fix bug resumeTimeoutScheduler on server restart

## 0.10.1 (October 9, 2018)

BUG FIXES:

- Fix nodes behind proxy node info cache invalidation when moving child node to another proxy node.
- Fix error when not providing `idp_id_list` (undefined) when creating a request.
- Add missing property `request_timeout` to AS data request callback data.

## 0.10.0 (October 7, 2018)

IMPROVEMENTS:

- Read only callback URLs from files that are relevant to node's role and external crypto service settings on server start.
- Cache nodes behind proxy node info to reduce RPC/HTTP query calls to Tendermint.

BUG FIXES:

- Fix receiver integrity check is skipped on AS and causes error.
- Fix receiver integrity check incorrect logic.
- Fix server initialization flow to wait for Tendermint sync before getting node's role and wait for MQ init before processing blocks and expected Txs.

## 0.9.0 (October 4, 2018)

BREAKING CHANGES:

- Change structure of `secret` (remove prepended padding). All `secret` need to be re-calculated.
- Change error type `INVALID_CIPHER` to `INVALID_SECRET`.
- When IdP creates response:
  - `secret` cannot be malformed (since it no longer has form).
  - `secret` will be checked for validity and may return `INVALID_SECRET`.

FEATURES:

- Add GET `/reinit_node_keys` for reading node keys from files again while the server is running.
- Add `data` JSON validation when AS responses data with POST `/as/data/:request_id/:service_id`. JSON schema of `data` of each service is fetched from blockchain.

IMPROVEMENTS:

- API version 2.3
  - Add `creation_block_height` property to IdP incoming request callback data.
  - Add `creation_time` and `creation_block_height` properties to AS service callback data.
  - Add `creation_block_height` to create request result, create identity request result, and add accessor request result callbacks. (Result callbacks of POST `/rp/requests/:namespace/:identifier`, POST `/identity`, and POST `/identity/:namespace/:identifier/accessors` respectively.)
  - Add `creation_block_height` and `idp_id_list` properties to result of GET `/utility/requests/:request_id`.
- Wait for DB (Redis) reconnect when the connection is down before processing received message from MQ.
- Wait for DB (Redis) to connect on server start. (Previously, stop server initialization process if fail to connect on the first try.)
- Group MQ message signing when sending request data from RP to AS. (Reduce message signing if payload is identical.)
- [MQ] Wait for receiver to save raw message to cache DB before sending ACK back to sender.
- Send `idp_id_list` to blockchain when creating a request.
- If input `as_id_list` or `idp_id_list` is an empty array, It will be replaced with a list of all potential AS/IDP node IDs.
- Check message from MQ against receiver node ID list in blockchain, whether receiver node is one of the designated receivers.
- Change `special` tag/property to `purpose` (with value `AddAccessor` to create identity or add accessor).
- Check IDP and AS IDs in request list when creating a request, error if any unqualified IDP/AS is present.

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
  - Add `request_message_salt` and `initial_salt` properties in object when calling callback to IdP with type `incoming_request`. This change also applies to API v1.
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
