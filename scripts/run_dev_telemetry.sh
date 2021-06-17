#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

cd telemetry

npm run build

NODE_ID=idp1,idp2,idp3,rp1,rp2,as1 \
TELEMETRY_DB_HOST=localhost \
TELEMETRY_DB_PORT=6379 \
TELEMETRY_NODE_GRPC_HOST=localhost \
TELEMETRY_NODE_GRPC_PORT=8880 \
FLUSH_INTERVAL_SEC=20 \
node build/index.js &

NODE_ID=proxy1_rp4,proxy1_idp4,proxy1_as4 \
TELEMETRY_DB_HOST=localhost \
TELEMETRY_DB_PORT=6380 \
TELEMETRY_NODE_GRPC_HOST=localhost \
TELEMETRY_NODE_GRPC_PORT=8880 \
FLUSH_INTERVAL_SEC=20 \
node build/index.js &

NODE_ID=proxy2_rp5 \
TELEMETRY_DB_HOST=localhost \
TELEMETRY_DB_PORT=6381 \
TELEMETRY_NODE_GRPC_HOST=localhost \
TELEMETRY_NODE_GRPC_PORT=8880 \
FLUSH_INTERVAL_SEC=20 \
node build/index.js &

wait
