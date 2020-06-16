[![CircleCI](https://circleci.com/gh/ndidplatform/api.svg?style=svg)](https://circleci.com/gh/ndidplatform/api)

# NDID API (Node.js)

## Prerequisites

- Node.js 12 or later (Recommended: latest version of Node.js 12 LTS)
- npm 6.12.0 or later
- Redis 3.2 or later

## Getting started

1.  Install dependencies

    ```sh
    # from repository root directory
    ./scripts/install_deps.sh
    ```

2.  Run smart contract (tendermint ABCI app) server in `smart-contract` repository and wait for first commit to show up in an output.

3.  Add development keys to the system (for development mode only)

    ```sh
    # from repository root directory
    cd main-server

    TENDERMINT_IP=$TENDERMINT_IP \
    TENDERMINT_PORT=$TENDERMINT_PORT \
    NODE_ID=ndid1 \
    npm run initDev
    ```

4.  Run a MQ service server

    ```sh
    # from repository root directory
    cd mq-server

    NODE_ID=$NODE_ID \
    MQ_BINDING_PORT=$MQ_BINDING_PORT \
    npm start
    ```

**Environment variable options**

- `NODE_ID`: (Must be the same as its server pair) *Description below* [Required]
- `MQ_BINDING_PORT`: (Must be the same as its server pair) *Description below* [Required]
- `SERVER_PORT`: gRPC server port [Default: `50051`]
- `MAX_CONCURRENT_MESSAGES_PER_MQ_SOCKET`: Maximum concurrent messages for each MQ sending socket [Default: `16`]
- `MAX_MQ_SOCKET`: Maximum limit for MQ sending sockets [Default: `10000`]
- `GRPC_PING_INTERVAL_MS`: gRPC ping interval in milliseconds [Default: `300000`]
- `GRPC_PING_TIMEOUT_MS`: gRPC ping timeout in milliseconds [Default: `20000`]
- `GRPC_EXPECTED_CLIENT_PING_INTERVAL_MS`: gRPC expected client ping interval in milliseconds. Must be less than `GRPC_PING_INTERVAL_MS` config on API server pair. [Default: `30000`]
- `LOG_LEVEL`: *Description below*
- `LOG_PRETTY_PRINT`: *Description below*
- `LOG_COLOR`: *Description below*
- `PROMETHEUS`
- `PROMETHEUS_SERVER_PORT`
- `PROMETHEUS_HTTPS`
- `PROMETHEUS_HTTPS_KEY_PATH`
- `PROMETHEUS_HTTPS_CERT_PATH`

5.  Run a main server

    ```sh
    # from repository root directory
    cd main-server

    NODE_ID=$NODE_ID \
    MQ_CONTACT_IP=$MQ_CONTACT_IP \
    npm start
    ```

**Environment variable options**

- `MODE`: Allowed values are `standalone`, `master`, and `worker`. There can be only one `master` process per Node ID [Default: `standalone`]
- `MASTER_SERVER_IP`: Master process gRPC server IP address. Required when MODE=master [Default: `localhost`]
- `MASTER_SERVER_PORT`: Master process gRPC server port. Required when MODE=master and MODE=worker [Default: `7000`]
- `CALL_TO_MASTER_RETRY_TIMEOUT_MS`: gRPC call from worker process to master process retry timeout in milliseconds [Default: `120000`]
- `NODE_ID`: Node ID ties to public key, in dev mode we have `rp1`, `rp2`, `rp3`, `idp1`, `idp2`, `idp3`, `as1`, `as2`, `as3` [Required]
- `NDID_NODE`: Set to `true` to skip getting role from blockchain and skip waiting for blockchain initialization ended. [Default: `false`]
- `TENDERMINT_IP`: IP Address to contact tendermint RPC [Default: `localhost`]
- `TENDERMINT_PORT`: Port to contact tendermint RPC [Default: `45000`]
- `TENDERMINT_WS_CONNECTIONS`: Number of Tendermint RPC WebSocket connections in connection pool. [Default: `10`]
- `MQ_CONTACT_IP`: An IP address where this NDID node message queue can be contacted [Required when role is set to `idp`, `rp`, or `as`]
- `MQ_BINDING_PORT`: A port to bind message queue [Default: `5555`]
- `MQ_SERVICE_SERVER_IP`: IP address of MQ service server [Default: `localhost`]
- `MQ_SERVICE_SERVER_PORT`: Port of MQ service server [Default: `50051`]
- `SERVER_PORT`: API server port [Default: `8080`]
- `PRIVATE_KEY_PATH`: Path to node's private key (if call back to create signature is not set) [Default: use pre-generated development key in development mode]
- `PRIVATE_KEY_PASSPHRASE`: Passphrase for node's private key
- `MASTER_PRIVATE_KEY_PATH`: Path to node's master private key (if call back to create signature is not set) [Default: use pre-generated development key in development mode]
- `MASTER_PRIVATE_KEY_PASSPHRASE`: Passphrase for node's master private key
- `NODE_BEHIND_PROXY_PRIVATE_KEY_DIRECTORY_PATH`: Directory path for nodes behind proxy private keys and passphrases [Default: use pre-generated development key in development mode]
- `NODE_BEHIND_PROXY_MASTER_PRIVATE_KEY_DIRECTORY_PATH`: Directory path for nodes behind proxy master private keys and passphrases [Default: use pre-generated development key in development mode]
- `DATA_DIRECTORY_PATH`: Directory path for persistence data files [Default: `__dirname/../data` (`data` directory in repository's directory)]
- `DEFAULT_API_VERSION`: API version to serve on default path (without version path prefix) [Default: `5`]
- `CALLBACK_API_VERSION`: Callback API version [Default: `5`]
- `DB_IP`: IP address of DB (redis) server [Default: `localhost`]
- `DB_PORT`: Port of DB (redis) server [Default: `6379`]
- `DB_PASSWORD`: Authentication password for DB (redis) connection
- `LOG_LEVEL`: Log level. Allowed values are `fatal`, `error`, `warn`, `info`, `debug` and `trace` [Default: `debug` in development, `info` in production]
- `LOG_PRETTY_PRINT`: Log prettifier (easy to read format). If not set to `true`, log will be in JSON format [Default: `true` in development, `false` otherwise]
- `LOG_COLOR`: Log highlight color [Default: `true` in development, `false` otherwise]
- `CLIENT_HTTP_ERROR_CODE`: HTTP error code when responding a client error [Default: `400`]
- `SERVER_HTTP_ERROR_CODE`: HTTP error code when responding a server error [Default: `500`]
- `USE_EXTERNAL_CRYPTO_SERVICE`: Use external service for decrypting and signing (e.g. HSM) [Default: `false`]
- `AUTO_CLOSE_REQUEST_ON_COMPLETED`: Automatically close a request as soon as status is `completed` (and when all IdP response signatures are valid in mode 2 and 3). (For RP role) [Default: `true`]
- `AUTO_CLOSE_REQUEST_ON_REJECTED`: Automatically close a request as soon as status is `rejected` (and when all IdP response signatures are valid in mode 2 and 3). (For RP role) [Default: `false`]
- `AUTO_CLOSE_REQUEST_ON_COMPLICATED`: Automatically close a request as soon as status is `complicated` (and when all IdP response signatures are valid in mode 2 and 3). (For RP role) [Default: `false`]
- `AUTO_CLOSE_REQUEST_ON_ERRORED`: Automatically close a request as soon as status is `errored`. (For RP role) [Default: `false`]
- `HTTPS`: Use HTTPS server [Default: `false`]
- `HTTPS_KEY_PATH`: HTTPS private key file path. Required when HTTPS=true [Default: pre-generated development key]
- `HTTPS_CERT_PATH`: HTTPS certificate file path. Required when HTTPS=true [Default: pre-generated development cert]
- `CALLBACK_RETRY_TIMEOUT`: Callback retry timeout in seconds. Only applies to some callbacks (that do not have shouldRetry function check e.g. request status update callback to RP client) [Default: `600`]
- `REGISTER_MQ_AT_STARTUP`: Flag to tell API node whether to register message queue address when start (will override previously registered address) [Default: `true` for RP, IdP, and AS roles, `false` for NDID role]
- `MAX_INTERVAL_TENDERMINT_SYNC_CHECK`: Maximum time interval in milliseconds for polling Tendermint syncing status on server start [Default: `15000`]
- `GRPC_PING_INTERVAL_MS`: gRPC ping interval in milliseconds [Default: `60000`]
- `GRPC_PING_TIMEOUT_MS`: gRPC ping timeout in milliseconds [Default: `20000`]
- `GRPC_EXPECTED_CLIENT_PING_INTERVAL_MS`: gRPC expected client ping interval in milliseconds. Used by `master` mode process. Must be less than `GRPC_PING_INTERVAL_MS` config on worker processes. [Default: `30000`]
- `GRPC_CALL_TIMEOUT_MS`: gRPC call timeout in milliseconds [Default: `60000`]
- `PROMETHEUS`: Enable prometheus metrics and HTTP server for querying metrics [Default: `false`]
- `PROMETHEUS_SERVER_PORT`: HTTP server port for querying Prometheus metrics [Default: `8888`]
- `PROMETHEUS_HTTPS`: Use HTTPS server for Prometheus metrics HTTP server [Default: `false`]
- `PROMETHEUS_HTTPS_KEY_PATH`: HTTPS private key file path for Prometheus metrics HTTP server. Required when PROMETHEUS_HTTPS=true [Default: pre-generated development key]
- `PROMETHEUS_HTTPS_CERT_PATH`: HTTPS certificate file path for Prometheus metrics HTTP server. Required when PROMETHEUS_HTTPS=true [Default: pre-generated development cert]

Debug APIs (Only in development mode)

- POST `/debug/tmQuery/:ABCI_FunctionName` with BODY to pass to ABCI app
- POST `/debug/tmTransact/:ABCI_FunctionName` with BODY to pass to ABCI app with extra 3 parameter (not pass to ABCI)
  - `debug_callbackUrl`: Callback url to receive result (MUST SET `debug_sync` to true)
  - `debug_useMasterKey`: Use master key to sign tx or not (boolean)
  - `debug_sync`: Wait for tx commit, or will callback (boolean)

**_Examples_**

- Run a server as an IDP

  ```sh
  TENDERMINT_IP=127.0.0.1 \
  TENDERMINT_PORT=45000 \
  MQ_CONTACT_IP=127.0.0.1 \
  MQ_BINDING_PORT=5555 \
  SERVER_PORT=8100 \
  NODE_ID=idp1 \
  npm start
  ```

- Run a server as a RP

  ```sh
  TENDERMINT_IP=127.0.0.1 \
  TENDERMINT_PORT=45001 \
  MQ_CONTACT_IP=127.0.0.1 \
  MQ_BINDING_PORT=5556 \
  SERVER_PORT=8200 \
  NODE_ID=rp1 \
  npm start
  ```

- Run a server as a AS

  ```sh
  TENDERMINT_IP=127.0.0.1 \
  TENDERMINT_PORT=45000 \
  MQ_CONTACT_IP=127.0.0.1 \
  MQ_BINDING_PORT=5557 \
  SERVER_PORT=8300 \
  NODE_ID=as1 \
  npm start
  ```

Don't forget to

1.  Set `SERVER_PORT` when running on the same machine to avoid port collision.
2.  Set `TENDERMINT_IP` and/or `TENDERMINT_PORT` when running `smart-contract`/`tendermint` on another machine.

## Run in Docker

Required

- Docker CE 17.06+ [Install docker](https://docs.docker.com/install/)
- docker-compose 1.14.0+ [Install docker-compose](https://docs.docker.com/compose/install/)

### Build

```
./docker/build.sh
```

### Run

```
docker-compose -f docker/docker-compose.yml up
```

### Note

- To run docker container without building image, run command show in **Run** section (no building required). It will run docker container with image from Dockerhub (https://hub.docker.com/r/ndidplatform/api/).
- To pull latest image from Dockerhub, run `docker pull ndidplatform/api` and `docker pull ndidplatform/mq`
- Docker container can be run with `-u` or `--user` flag (e.g. `-u 65534:65534`). In case you are using docker-compose, `user` can be specified in docker-compose file (e.g. `user: 65534:65534`) (see [Compose file reference](https://docs.docker.com/compose/compose-file/#domainname-hostname-ipc-mac_address-privileged-read_only-shm_size-stdin_open-tty-user-working_dir) for more detail).
- When running docker container with non-root user, source directories that will be mounted into the container as `DATA_DIRECTORY_PATH` must be created beforehand with the non-root user as owner.

## Logging

Both main server and MQ service server only log to stdout. For log rotation, see http://getpino.io/#/docs/help?id=log-rotation.

## Note

- When running as a proxy node:
  - DB (Redis) should not be shared with other proxy node.
  - `NODE_BEHIND_PROXY_PRIVATE_KEY_DIRECTORY_PATH` is where node behind proxy private keys are stored. The server expects key filename to be node's ID. If keys have a passphrase, it should be in a text file with filename `<NODE_ID>_passphrase`
  - `NODE_BEHIND_PROXY_MASTER_PRIVATE_KEY_DIRECTORY_PATH` is where node behind proxy master private keys are stored. The server expects key filename to be `<NODE_ID>_master`. If keys have a passphrase, it should be in a text file with filename `<NODE_ID>_master_passphrase`
- When working in development, if you clear/delete the blockchain, you need to delete latest block height files by running `npm run delete-local-data-cache`. (Automatically run when running `npm run initDev`) For docker, run `npm run docker-down` or `docker-compose -f docker/docker-compose.yml down` before starting containers again.
