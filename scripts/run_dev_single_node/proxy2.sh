#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

# redis-server --port 6381 &

# redis-cli -p 6381 FLUSHALL

docker run --rm -p 6381:6379 --name ndid_redis_3 redis:5-alpine &

cd mq-server

# npm run build

NODE_ID=proxy2 \
MQ_BINDING_PORT=5301 \
SERVER_PORT=53001 \
node build/server.js &

cd ../main-server

# npm run build

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45003 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5301 \
MQ_SERVICE_SERVER_PORT=53001 \
SERVER_PORT=8401 \
NODE_ID=proxy2 \
DB_PORT=6381 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
node --security-revert=CVE-2023-46809 build/server.js &

wait