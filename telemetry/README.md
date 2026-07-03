# NDID Telemetry Module

Collect activities on NDID API server and forward to NDID telemetry server

## Data collected by telemetry

- Request states/events
- Software versions (API main server, MQ service server, Tendermint and ABCI app)

## Prerequisites

- Node.js 18 or later (Recommended: latest version of Node.js 20 LTS)
- npm 8 or later
- Redis **5.0** or later

## How to start Telemetry module

1. Start a simple Redis database

   Note that this db can be shared with your current Redis DB
   (if so, then you have no need to specify `TELEMETRY_DB_HOST`, `TELEMETRY_DB_PORT`, and `TELEMETRY_DB_PASSWORD` when running API main server. The old values will be used)

   **However, to use the old Redis, the version of that Redis has to meet the minimum requirement above.**

2. Before starting the API main server, add the following environment variables

   ```sh
   ENABLE_TELEMETRY_LOGGING=true

   # omit these, if you are using the same database as the one used by API server
   TELEMETRY_DB_HOST=127.0.0.1 # change to your database host
   TELEMETRY_DB_PORT=6379 # change to your database port
   TELEMETRY_DB_PASSWORD=<password>
   ```

3. Start the API server using the instruction on the root directory.

4. Start the telemetry module

   ```sh
   # you CANNOT omit these values
   NODE_ID=idp1,rp1 \
   TELEMETRY_DB_HOST=127.0.0.1 \
   TELEMETRY_DB_PORT=6379 \
   TELEMETRY_DB_PASSWORD=<password> \
   TELEMETRY_NODE_GRPC_HOST=telemetry.ndid.co.th \
   TELEMETRY_NODE_GRPC_PORT=80 \
   FLUSH_INTERVAL_SEC=10 \
   npm start
   ```

**Environment Variable options**

- `NODE_ID`: List of monitored node IDs separated by commas (','). [Required]
- `TELEMETRY_DB_HOST`: Host/IP of Redis DB database [Required]
- `TELEMETRY_DB_PORT`: Port of Redis DB database [Required]
- `TELEMETRY_DB_PASSWORD`: Password of Redis DB database
- `TELEMETRY_DB_TLS`: Enable TLS encryption for the Redis connection [Default: `false`]
- `TELEMETRY_DB_TLS_CA_PATH`: File path to the custom Root CA certificate used to validate the Redis server's identity.
- `TELEMETRY_DB_TLS_REJECT_UNAUTHORIZED`: If `true`, strictly verifies the Redis server certificate against the CA. Set to `false` to bypass certificate verification errors. [Default: `true`]
- `TELEMETRY_DB_TLS_KEY_PATH`: File path to the client private key (Required only if using **mTLS**).
- `TELEMETRY_DB_TLS_CERT_PATH`: File path to the client public certificate (Required only if using **mTLS**).
- `TELEMETRY_NODE_GRPC_HOST`: Host/IP of target telemetry node gRPC server (should be given by NDID) [Required]
- `TELEMETRY_NODE_GRPC_PORT`: Port of target telemetry node gRPC server (should be given by NDID) [Required]
- `GRPC_PING_INTERVAL_MS`: Ping interval in millisecond [Default: `60000`]
- `GRPC_PING_TIMEOUT_MS`: Ping timeout in millisecond [Default: `20000`]
- `GRPC_SSL`: Use SSL for gRPC connection to telemetry node server [Default: `false`]
- `GRPC_SSL_ROOT_CERT_FILE_PATH`: SSL root certificate filepath to use with gRPC connection. Use when `GRPC_SSL` is set to `true` [Default: Node.js built-in root certificates. More info: https://nodejs.org/api/tls.html#tls_tls_rootcertificates]
- `GRPC_SSL_KEY_FILE_PATH`: Client key filepath for gRPC connection. Use when `GRPC_SSL` is set to `true`.
- `GRPC_SSL_CERT_FILE_PATH`: Client certificate filepath for gRPC connection. Use when `GRPC_SSL` is set to `true`.
- `FLUSH_INTERVAL_SEC`: Amount of time between each data shipping in second [Default: `10`]
- `REQUEST_EVENT_STREAM_MAX_CAPACITY`: Maximum number of items in request events Redis streams [Default: `1000000`]
