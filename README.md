# NDID API (Node.js)

## Prerequisites

- Node.js 8.9 or later
- npm 5.6.0 or later

## Getting started

1.  Install dependencies

    ```
    npm install
    ```

2.  Run Node Logic server (tendermint ABCI) in `ndid-node-logic` repository

3.  Run a server

    ```
    npm start
    ```

(OPTIONAL) set enviroment variable when run as IDP

    ```
    IDP=true run as IDP,
    IDP_IP=____ register IP for message queue (IDP only)
    IDP_PORT=___ register PORT for message queue (IDP only)
    ASSOC_USERS=___ json file path, array of { namespace, identifier } this IDP associate with
    Ex.
    IDP=true IDP_IP=192.168.1.1 IDP_PORT=3000 ASSOC_USERS=users.json npm start
    ```