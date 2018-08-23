[![CircleCI](https://circleci.com/gh/ndidplatform/api.svg?style=svg)](https://circleci.com/gh/ndidplatform/api)

# NDID API (Node.js)

## Prerequisites

- Node.js 8.9 or later (Recommended: latest version of Node.js 8 LTS)
- npm 5.6.0 or later
- (On Windows) [OpenSSL 1.0.2](https://slproweb.com/products/Win32OpenSSL.html) (OpenSSL 1.1.0 will not work)

## Getting started

1.  Install dependencies

    ```sh
    npm install
    ```

2.  Run smart contract (tendermint ABCI app) server in `smart-contract` repository and wait for first commit to show up in an output.

3.  Add development keys to the system (for development mode only)

    ```sh
    TENDERMINT_IP=$IP \
    TENDERMINT_PORT=$PORT \
    NODE_ID=ndid1 \
    npm run initDevKey
    ```

4.  Run a server

    ```sh
    ROLE=$ROLE \
    NODE_ID=$NODE_ID \
    npm start
    ```

**Environment variable options**

- `ROLE`: Can be `idp`, `rp`, `as`, or `ndid` [Required]
- `TENDERMINT_IP`: IP Address to contact tendermint RPC [Default: `localhost`]
- `TENDERMINT_PORT`: Port to contact tendermint RPC [Default: `45000` for IDP, `45001` for RP, and `45002` for AS]
- `MQ_CONTACT_IP`: An IP address where this NDID node message queue can be contacted [Required when role is set to `idp`, `rp`, or `as`]
- `MQ_BINDING_PORT`: A port to bind message queue [Default: `5555`]
- `SERVER_PORT`: API server port [Default: `8080`]
- `PRIVATE_KEY_PATH`: Path to node's private key (if call back to create signature is not set) [Default: using pre-generated development key]
- `PRIVATE_KEY_PASSPHRASE`: Passphrase for node's private key
- `MASTER_PRIVATE_KEY_PATH`: Path to node's master private key (if call back to create signature is not set) [Default: using pre-generated development key]
- `MASTER_PRIVATE_KEY_PASSPHRASE`: Passphrase for node's master private key
- `NODE_ID`: Node ID. Only when there are more than one node per role in the system. This ID tie to public key, in dev mode we have `rp1`, `rp2`, `rp3`, `idp1`, `idp2`, `idp3`, `as1`, `as2`, `as3` [Required]
- `DATA_DIRECTORY_PATH`: Directory path for persistence data files [Default: `__dirname/../data` (`data` directory in repository's directory)]
- `LOG_LEVEL`: Log level. Allowed values are `error`, `warn`, `info`, `verbose`, `debug` and `silly` [Default: `debug` in development, `info` in production]
- `LOG_FORMAT`: Log format. Allowed values are `default` and `json` [Default: `default`]
- `LOG_TARGET`: Where should logger writes logs to. Allowed values are `console` and `file` [Default: `console`]
- `LOG_COLOR`: Log highlight color [Default: `true` when log target is console, `false` otherwise]
- `LOG_ONE_LINE`: Log in a single line (no line break) [Default: `false`]
- `LOG_DIRECTORY_PATH`: Directory path for log files (use when `LOG_TARGET` is set to `file`) [Default: `__dirname/../log` (`log` directory in repository's directory)]
- `CLIENT_HTTP_ERROR_CODE`: HTTP error code when responding a client error [Default: `400`]
- `SERVER_HTTP_ERROR_CODE`: HTTP error code when responding a server error [Default: `500`]
- `USE_EXTERNAL_CRYPTO_SERVICE`: Use external service for decrypting and signing (e.g. HSM) [Default: `false`]
- `HTTPS`: Use HTTPS server [Default: `false`]
- `HTTPS_KEY_PATH`: HTTPS private key file path. Required when HTTPS=true [Default: pre-generated development key]
- `HTTPS_CERT_PATH`: HTTPS certificate file path. Required when HTTPS=true [Default: pre-generated development cert]
- `CREATE_IDENTITY_REQUEST_MESSAGE_TEMPLATE_PATH`: Request message template in mustache format filepath to use in consent request when creating identity [Default: `../request_message_templates/create_identity.mustache`][required in production]
- `ADD_ACCESSOR_REQUEST_MESSAGE_TEMPLATE_PATH`: Request message template in mustache format filepath to use in consent request when adding new accessor [Default: `../request_message_templates/add_accessor.mustache`][required in production]
- `CALLBACK_RETRY_TIMEOUT`: Callback retry timeout in seconds. Only applies to some callbacks (that do not have shouldRetry function check e.g. request status update callback to RP client) [Default: `600`]
- `REGISTER_MQ_AT_STARTUP`: Flag to tell API node whether to register message queue address when start (will override previously registered address) [Default: `true` for RP, IdP, and AS roles, `false` for NDID role]
- `MAX_INTERVAL_TENDERMINT_SYNC_CHECK`: Maximum time interval in milliseconds for polling Tendermint syncing status on server start [Default: `15000`]

Debug APIs (Only in development mode)

- POST `/debug/tmQuery/:ABCI_FunctionName` with BODY to pass to ABCI app
- POST `/debug/tmTransact/:ABCI_FunctionName` with BODY to pass to ABCI app with extra 3 parameter (not pass to ABCI)
  - `debug_callbackUrl`: Callback url to receive result (MUST SET `debug_sync` to true)
  - `debug_useMasterKey`: Use master key to sign tx or not (boolean)
  - `debug_sync`: Wait for tx commit, or will callback (boolean)

**_Examples_**

- Run a server as an IDP

  ```sh
  ROLE=idp \
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
  ROLE=rp \
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
  ROLE=as \
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
3.  Set `NODE_ID` when there are more than one node per role in the system.

## Run in Docker

Required

- Docker CE 17.06+ [Install docker](https://docs.docker.com/install/)
- docker-compose 1.14.0+ [Install docker-compose](https://docs.docker.com/compose/install/)

### Build

```
npm run docker-build
```

or

```
./docker/build.sh
```

### Run

```
npm run docker-up
```

or

```
docker-compose -f docker/docker-compose.yml up
```

### Note

- To run docker container without building image, run command show in **Run** section (no building required). It will run docker container with image from Dockerhub (https://hub.docker.com/r/ndidplatform/api/).
- To pull latest image from Dockerhub, run `docker pull ndidplatform/api`

## Note

- When working in development, if you clear/delete the blockchain, you need to delete DB files and latest block height files by running `npm run delete-local-data-cache`. (Automatically run when running `npm run initDevKey`) For docker, run `npm run docker-down` or `docker-compose -f docker/docker-compose.yml down` before starting containers again.
