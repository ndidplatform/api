#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

cd mq-server

npm run build

NODE_ID=idp1 \
MQ_BINDING_PORT=5555 \
SERVER_PORT=50051 \
node build/server.js &

NODE_ID=idp2 \
MQ_BINDING_PORT=5655 \
SERVER_PORT=50052 \
node build/server.js &

NODE_ID=rp1 \
MQ_BINDING_PORT=5556 \
SERVER_PORT=50053 \
node build/server.js &

NODE_ID=as1 \
MQ_BINDING_PORT=5557 \
SERVER_PORT=50054 \
node build/server.js &

NODE_ID=as2 \
MQ_BINDING_PORT=5558 \
SERVER_PORT=50055 \
node build/server.js &

NODE_ID=proxy1 \
MQ_BINDING_PORT=5658 \
SERVER_PORT=50056 \
node build/server.js &

NODE_ID=proxy2 \
MQ_BINDING_PORT=5659 \
SERVER_PORT=50057 \
node build/server.js &

wait