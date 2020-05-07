#!/bin/bash

docker run --rm -p 6379:6379 --name ndid_redis_1 -d redis:4-alpine

cd main-server

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
NODE_ID=ndid1 \
npm run initDev

docker stop ndid_redis_1
