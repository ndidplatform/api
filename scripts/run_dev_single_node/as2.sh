#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

# redis-server --port 6379 &

# redis-cli -p 6379 FLUSHALL

docker run --rm -p 6379:6379 --name ndid_redis_1 redis:4-alpine &

cd mq-server

# npm run build

NODE_ID=as2 \
MQ_BINDING_PORT=5201 \
SERVER_PORT=52001 \
node build/server.js &

cd ../main-server

# npm run build

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45002 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5201 \
MQ_SERVICE_SERVER_PORT=52001 \
SERVER_PORT=8301 \
NODE_ID=as2 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
node build/server.js &

wait