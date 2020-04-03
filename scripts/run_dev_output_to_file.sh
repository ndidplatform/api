#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

# nohup redis-cli -p 6379 FLUSHALL
# nohup redis-cli -p 6380 FLUSHALL
# nohup redis-cli -p 6381 FLUSHALL

# nohup redis-server --port 6379 > redis_1.log &
# nohup redis-server --port 6380 > redis_2.log &
# nohup redis-server --port 6381 > redis_3.log &

docker run --rm -p 6379:6379 --name ndid_redis_1 redis:4-alpine &
docker run --rm -p 6380:6379 --name ndid_redis_2 redis:4-alpine &
docker run --rm -p 6381:6379 --name ndid_redis_3 redis:4-alpine &

cd mq-server

npm run build

NODE_ID=idp1 \
MQ_BINDING_PORT=5555 \
SERVER_PORT=50051 \
nohup node build/server.js > mq_idp1.log &

NODE_ID=idp2 \
MQ_BINDING_PORT=5655 \
SERVER_PORT=50052 \
nohup node build/server.js > mq_idp2.log &

NODE_ID=rp1 \
MQ_BINDING_PORT=5556 \
SERVER_PORT=50053 \
nohup node build/server.js > mq_rp1.log &

NODE_ID=as1 \
MQ_BINDING_PORT=5557 \
SERVER_PORT=50054 \
nohup node build/server.js > mq_as1.log &

NODE_ID=as2 \
MQ_BINDING_PORT=5558 \
SERVER_PORT=50055 \
nohup node build/server.js > mq_as2.log &

NODE_ID=proxy1 \
MQ_BINDING_PORT=5658 \
SERVER_PORT=50056 \
nohup node build/server.js > mq_proxy1.log &

NODE_ID=proxy2 \
MQ_BINDING_PORT=5659 \
SERVER_PORT=50057 \
nohup node build/server.js > mq_proxy2.log &

cd ../main-server

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
NODE_ID=ndid1 \
npm run initDevKey

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
NODE_ID=ndid1 \
NDID_NODE=true \
USE_EXTERNAL_CRYPTO_SERVICE=true \
nohup node build/server.js > api_ndid1.log &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5555 \
MQ_SERVICE_SERVER_PORT=50051 \
SERVER_PORT=8100 \
NODE_ID=idp1 \
USE_EXTERNAL_CRYPTO_SERVICE=true \
nohup node build/server.js > api_idp1.log &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5655 \
MQ_SERVICE_SERVER_PORT=50052 \
SERVER_PORT=8101 \
NODE_ID=idp2 \
USE_EXTERNAL_CRYPTO_SERVICE=true \
nohup node build/server.js > api_idp2.log &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45001 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5556 \
MQ_SERVICE_SERVER_PORT=50053 \
SERVER_PORT=8200 \
NODE_ID=rp1 \
USE_EXTERNAL_CRYPTO_SERVICE=true \
node build/server.js &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45002 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5557 \
MQ_SERVICE_SERVER_PORT=50054 \
SERVER_PORT=8300 \
NODE_ID=as1 \
USE_EXTERNAL_CRYPTO_SERVICE=true \
nohup node build/server.js > api_as1.log &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45002 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5558 \
MQ_SERVICE_SERVER_PORT=50055 \
SERVER_PORT=8301 \
NODE_ID=as2 \
USE_EXTERNAL_CRYPTO_SERVICE=true \
nohup node build/server.js > api_as2.log &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45003 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5658 \
MQ_SERVICE_SERVER_PORT=50056 \
SERVER_PORT=8400 \
NODE_ID=proxy1 \
DB_PORT=6380 \
USE_EXTERNAL_CRYPTO_SERVICE=true \
nohup node build/server.js > api_proxy1.log &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45003 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5659 \
MQ_SERVICE_SERVER_PORT=50057 \
SERVER_PORT=8401 \
NODE_ID=proxy2 \
DB_PORT=6381 \
USE_EXTERNAL_CRYPTO_SERVICE=true \
nohup node build/server.js > api_proxy2.log &

wait