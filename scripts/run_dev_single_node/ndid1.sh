#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

# redis-server --port 6379 &
# redis-server --port 6380 &
# redis-server --port 6381 &

# redis-cli -p 6379 FLUSHALL
# redis-cli -p 6380 FLUSHALL
# redis-cli -p 6381 FLUSHALL

docker run --rm -p 6379:6379 --name ndid_redis_1 redis:4-alpine &

cd main-server

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
NODE_ID=ndid1 \
NDID_NODE=true \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
node build/server.js &

wait