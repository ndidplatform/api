# NDID API Telemetry Module

Collect activities on NDID API server and forward to NDID telemetry sever

## Prerequisites

- Node.js 12 or later (Recommended: latest version of Node.js 12 LTS)
- npm 6.12.0 or later
- Redis **5.0** or later

## How to start Telemetry module

1. Start a simple Redis database  
Note that this db can be shared with your current Redis DB
(if so, then you have no need to specified `TELEMETRY_DB_IP` `TELEMETRY_DB_PORT` `TELEMETRY_DB_PASSWORD`, the old value will be used)  
**However, to use the old Redis, the version of that Redis has to meet the minimum requirement above.**

1. Before start the API server, add the following environment variables
```
ENABLE_TELEMETRY_LOGGING=true

# omit these, if you are using the same database as the one used by API server
TELEMETRY_DB_IP=127.0.0.1 # change to your database ip
TELEMETRY_DB_PORT=6379 # change to your database port
TELEMETRY_DB_PASSWORD=<password>
```

2. Start the API server using the instruction on the root directory.

3. Start the telemetry module
```sh \
# you CANNOT omit these values,
NODE_ID=idp1,rp1 \
TELEMETRY_DB_IP=127.0.0.1 \
TELEMETRY_DB_PORT=6379 \
TELEMETRY_DB_PASSWORD=<password> \
TELEMETRY_NODE_IP=telemetry.ndid.co.th \
TELEMETRY_NODE_PORT=80 \
FLUSH_INTERVAL_SEC=10 \
npm start
```

**Environment Variable options**

- `NODE_ID`: List of montored nodes separated by commas (',').
- `TELEMETRY_DB_IP`: IP of Redis DB database
- `TELEMETRY_DB_PORT`: Port of Redis DB database
- `TELEMETRY_DB_PASSWORD`: Password of Redis DB database
- `TELEMETRY_NODE_IP`: IP of target telemetry node server (should be given by NDID)
- `TELEMETRY_NODE_PORT`: Port of target telemetry node server (should be given by NDID)
- `GRPC_PING_INTERVAL_MS`: ping interval in millisecond
- `GRPC_PING_TIMEOUT_MS`: ping timeout in millisecond
- `FLUSH_INTERVAL_SEC`: Amount of time between each data shipping in second (default: 10 seconds)

