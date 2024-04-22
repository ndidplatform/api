#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

# redis-server --port 6379 &

# redis-cli -p 6379 FLUSHALL

docker run --rm -p 6379:6379 --name ndid_redis_1 redis:5-alpine &

cd mq-server

# npm run build

NODE_ID=idp1 \
MQ_BINDING_PORT=5000 \
SERVER_PORT=50000 \
node build/server.js &

cd ../main-server

# npm run build

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5000 \
MQ_SERVICE_SERVER_PORT=50000 \
SERVER_PORT=8100 \
NODE_ID=idp1 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
node --security-revert=CVE-2023-46809 build/server.js &

wait