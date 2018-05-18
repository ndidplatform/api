# NDID API (Node.js)

## Prerequisites

* Node.js 8.9 or later
* npm 5.6.0 or later

## Getting started

1.  Install dependencies

    ```sh
    npm install
    ```

2.  Run smart contract (tendermint ABCI app) server in `smart-contract` repository and wait for

    ```sh
    Commit
    Commit
    ```

    to show in an output before starting `api` process.

3.  Add development keys to the system (for development mode only)

    ```sh
    TENDERMINT_IP=$IP \
    TENDERMINT_PORT=$PORT \
    npm run initDevKey
    ```

4.  Run a server

    ```sh
    ROLE=$ROLE \
    npm start
    ```

## Run in Docker

Required

* Docker CE [Install docker](https://docs.docker.com/install/)
* docker-compose [Install docker-compose](https://docs.docker.com/compose/install/)

```
docker network create ndidplatform
docker-compose up
```

**Environment variable options**

* `ROLE`: Can be `idp`, `rp`, or `as`
* `TENDERMINT_IP`: IP Address to contact tendermint RPC [Default: `localhost`]
* `TENDERMINT_PORT`: Port to contact tendermint RPC [Default: `45000` for IDP, `45001` for RP, and `45002` for AS]
* `MQ_CONTACT_IP`: An IP address where this NDID node message queue can be contacted [Required]
* `MQ_BINDING_PORT`: A port to bind message queue [Default: `5555`]
* `SERVER_PORT`: API server port [Default: `8080`]
* `PRIVATE_KEY_PATH`: Path to private key (if call back to create signature is not set) [Default: using pre-generated development key]
* `NODE_ID`: Node ID. Only when there are more than one node per role in the system. This ID tie to public key, in dev mode we have `rp1`, `rp2`, `rp3`, `idp1`, `idp2`, `idp3`, `as1`, `as2`, `as3`

**_Examples_**

* Run a server as an IDP

  ```sh
  ROLE=idp \
  MQ_CONTACT_IP=192.168.1.1 \
  MQ_BINDING_PORT=5555 \
  npm start
  ```

* Run a server as a RP

  ```sh
  ROLE=rp \
  MQ_CONTACT_IP=192.168.1.1 \
  MQ_BINDING_PORT=5555 \
  npm start
  ```

* Run a server as a AS

  ```sh
  ROLE=as \
  MQ_CONTACT_IP=192.168.1.1 \
  MQ_BINDING_PORT=5555 \
  npm start
  ```

Don't forget to

1.  Set `SERVER_PORT` when running on the same machine to avoid port collision.
2.  Set `TENDERMINT_IP` and/or `TENDERMINT_PORT` when running `smart-contract`/`tendermint` on another machine.
3.  Set `NODE_ID` when there are more than one node per role in the system.

## Note

* When working in development, if you clear/delete the blockchain, you need to delete DB files and latest block height files. Run `npm run reset-data-for-dev`.

* Run `npm run delete-local-db-cache` to delete local DB used for caching. Local DB file name is `db-api-` following by node ID (env: `NODE_ID`) set on server start (e.g. `db-api-idp1` when node ID is set to `idp1`).

* Run `npm run delete-latest-block-height` to delete persistent latest block height saved by the server. File name is `latest-block-height-` following by node ID (env: `NODE_ID`).
