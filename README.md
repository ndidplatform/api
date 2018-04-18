# NDID API (Node.js)

## Prerequisites

* Node.js 8.9 or later
* npm 5.6.0 or later

## Getting started

1.  Install dependencies

    ```
    npm install
    ```

2.  Run Node Logic server (tendermint ABCI) in `ndid-smart-contract` repository

3.  Run a server

    ```
    npm start
    ```

    **Environment variable options**
    * `ROLE`: Can be `idp`, `rp`, or `as` (`as` is to be implemented),
    * `SMART_CONTRACT_ADDRESS`: Address to contact `ndid-smart-contract` [Default: `http://localhost:45001` for RP and `http://localhost:45000` for idp]
    * `MSQ_CONTACT_IP`: An IP address where this NDID node message queue can be contacted (IDP only) [Required]
    * `MSQ_BINDING_PORT`: A port to bind message queue (IDP only) [Default: `5555`]
    * `SERVER_PORT`: API server port [Default: `8080`]
    * `SMART_CONTRACT_CALLBACK_PORT`: port which `ndid-smart-contract` send callback [Default: `3001`] (must match `ndid-smart-contract`)
    * `SMART_CONTRACT_CALLBACK_PATH`: path which `ndid-smart-contract` send callback [Default: `/callback`] (must match `ndid-smart-contract`)
    * `ASSOC_USERS`: json file path, array of { namespace, identifier } this IDP associate with (In production environment, this will be done by onboarding process)

    ***Examples***

    * Run a server as an IDP

        ```
        ROLE=idp \
        MSQ_CONTACT_IP=192.168.1.1 \
        MSQ_BINDING_PORT=5555 \
        ASSOC_USERS=users.json \
        npm start
        ```
    
    * Run a server as an RP

        ```
        ROLE=rp \
        npm start
        ```
    
    Don't forget to 
    1. Set `SERVER_PORT` and `NODE_LOGIC_CALLBACK_PORT` when run on the same machine to avoid port collision.
    2. Set `SMART_CONTRACT_ADDRESS` when run `ndid-smart-contract` on another machine.