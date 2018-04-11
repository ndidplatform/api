# NDID API (Node.js)

## Prerequisites

* Node.js 8.9 or later
* npm 5.6.0 or later

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

    **Environment variable options**
    * `ROLE`: `idp`, `rp`, or `as`,
    * `NODE_LOGIC_ADDRESS`: Address to contact Node Logic [Default: `http://localhost:45001`]
    * `MSQ_CONTACT_IP`: An IP address where this NDID node message queue can be contacted (IDP only) [Required]
    * `MSQ_BINDING_PORT`: A port to bind message queue (IDP only) [Default: `3001`]
    * `ASSOC_USERS`: json file path, array of { namespace, identifier } this IDP associate with

    **Examples**
    * Run a server as an IDP

        ```
        ROLE=idp \
        NODE_LOGIC_ADDRESS=http://192.168.1.10:45001 \
        MSQ_BINDING_IP=192.168.1.1 \
        MSQ_BINDING_PORT=3000 \
        ASSOC_USERS=users.json \
        npm start
        ```