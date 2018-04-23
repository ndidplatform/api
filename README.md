# NDID API (Node.js)

## Prerequisites

* Node.js 8.9 or later
* npm 5.6.0 or later

## Getting started

1.  Install dependencies

    ```sh
    npm install
    ```

2.  Run smart contract (tendermint ABCI app) server in `ndid-smart-contract` repository and wait for

    ```sh
    Commit
    Commit
    ```

    to show in an output before starting `ndid-api` process.

3.  Run a server

    ```sh
    ROLE=$ROLE \
    npm start
    ```

**Environment variable options**

* `ROLE`: Can be `idp`, `rp`, or `as`
* `TENDERMINT_ADDRESS`: Address to contact `ndid-smart-contract` [Default: `http://localhost:45000` for IDP, `http://localhost:45001` for RP, and `http://localhost:45001` for AS]
* `MQ_CONTACT_IP`: An IP address where this NDID node message queue can be contacted [Required]
* `MQ_BINDING_PORT`: A port to bind message queue [Default: `5555`]
* `SERVER_PORT`: API server port [Default: `8080`]
* `ABCI_APP_CALLBACK_PORT`: port which `ndid-smart-contract` send callback [Default: `3001`] (must match `ndid-smart-contract`)
* `ABCI_APP_CALLBACK_PATH`: path which `ndid-smart-contract` send callback [Default: `/callback`] (must match `ndid-smart-contract`)
* `ASSOC_USERS`: json file path, array of { namespace, identifier } this IDP associate with (In production environment, this will be done by onboarding process)
* `AS_ID`: AS ID for register service (AS only)

**_Examples_**

* Run a server as an IDP

  ```sh
  ROLE=idp \
  MQ_CONTACT_IP=192.168.1.1 \
  MQ_BINDING_PORT=5555 \
  ASSOC_USERS=users.json \
  npm start
  ```

* Run a server as a RP

  ```sh
  ROLE=rp \
  npm start
  ```

* Run a server as a AS

  ```sh
  ROLE=as \
  AS_ID=AS1 \
  npm start
  ```

Don't forget to

1.  Set `SERVER_PORT` and `ABCI_APP_CALLBACK_PORT` when running on the same machine to avoid port collision.
2.  Set `TENDERMINT_ADDRESS` when running `ndid-smart-contract` on another machine.
