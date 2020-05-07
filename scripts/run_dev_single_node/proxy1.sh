#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

# redis-server --port 6380 &

# redis-cli -p 6380 FLUSHALL

docker run --rm -p 6380:6379 --name ndid_redis_2 redis:4-alpine &

cd mq-server

# npm run build

NODE_ID=proxy1 \
MQ_BINDING_PORT=5300 \
SERVER_PORT=53000 \
node build/server.js &

cd ../main-server

# npm run build

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45003 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5300 \
MQ_SERVICE_SERVER_PORT=53000 \
SERVER_PORT=8400 \
NODE_ID=proxy1 \
DB_PORT=6380 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
node build/server.js &

wait