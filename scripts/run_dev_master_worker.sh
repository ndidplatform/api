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

docker run --rm -p 6379:6379 --name ndid_redis_1 redis:5-alpine &
docker run --rm -p 6380:6379 --name ndid_redis_2 redis:5-alpine &
docker run --rm -p 6381:6379 --name ndid_redis_3 redis:5-alpine &

cd mq-server

npm run build

NODE_ID=idp1 \
MQ_BINDING_PORT=5000 \
SERVER_PORT=50000 \
node build/server.js &

NODE_ID=idp2 \
MQ_BINDING_PORT=5001 \
SERVER_PORT=50001 \
node build/server.js &

NODE_ID=idp3 \
MQ_BINDING_PORT=5002 \
SERVER_PORT=50002 \
node build/server.js &

NODE_ID=rp1 \
MQ_BINDING_PORT=5100 \
SERVER_PORT=51000 \
node build/server.js &

NODE_ID=rp2 \
MQ_BINDING_PORT=5101 \
SERVER_PORT=51001 \
node build/server.js &

NODE_ID=as1 \
MQ_BINDING_PORT=5200 \
SERVER_PORT=52000 \
node build/server.js &

NODE_ID=as2 \
MQ_BINDING_PORT=5201 \
SERVER_PORT=52001 \
node build/server.js &

NODE_ID=proxy1 \
MQ_BINDING_PORT=5300 \
SERVER_PORT=53000 \
node build/server.js &

NODE_ID=proxy2 \
MQ_BINDING_PORT=5301 \
SERVER_PORT=53001 \
node build/server.js &

cd ../main-server

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
NODE_ID=ndid1 \
npm run initDev

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
NODE_ID=ndid1 \
NDID_NODE=true \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=false \
node --security-revert=CVE-2023-46809 build/server.js &

MODE=master \
MASTER_SERVER_PORT=7000 \
TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
DB_IP=127.0.0.1 \
DB_PORT=6379 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5000 \
MQ_SERVICE_SERVER_PORT=50000 \
SERVER_PORT=8100 \
NODE_ID=idp1 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

MODE=worker \
MASTER_SERVER_IP=127.0.0.1 \
MASTER_SERVER_PORT=7000 \
TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
DB_IP=127.0.0.1 \
DB_PORT=6379 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5000 \
MQ_SERVICE_SERVER_PORT=50000 \
SERVER_PORT=8100 \
NODE_ID=idp1 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5001 \
MQ_SERVICE_SERVER_PORT=50001 \
SERVER_PORT=8101 \
NODE_ID=idp2 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5002 \
MQ_SERVICE_SERVER_PORT=50002 \
SERVER_PORT=8102 \
NODE_ID=idp3 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

MODE=master \
MASTER_SERVER_PORT=7001 \
TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45001 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5100 \
MQ_SERVICE_SERVER_PORT=51000 \
SERVER_PORT=8200 \
NODE_ID=rp1 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

MODE=worker \
MASTER_SERVER_IP=127.0.0.1 \
MASTER_SERVER_PORT=7001 \
TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45001 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5100 \
MQ_SERVICE_SERVER_PORT=51000 \
SERVER_PORT=8200 \
NODE_ID=rp1 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45001 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5101 \
MQ_SERVICE_SERVER_PORT=51001 \
SERVER_PORT=8201 \
NODE_ID=rp2 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

MODE=master \
MASTER_SERVER_PORT=7002 \
TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45002 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5200 \
MQ_SERVICE_SERVER_PORT=52000 \
SERVER_PORT=8300 \
NODE_ID=as1 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

MODE=worker \
MASTER_SERVER_IP=127.0.0.1 \
MASTER_SERVER_PORT=7002 \
TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45002 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5200 \
MQ_SERVICE_SERVER_PORT=52000 \
SERVER_PORT=8300 \
NODE_ID=as1 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45002 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5201 \
MQ_SERVICE_SERVER_PORT=52001 \
SERVER_PORT=8301 \
NODE_ID=as2 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

MODE=master \
MASTER_SERVER_PORT=7003 \
TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45003 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5300 \
MQ_SERVICE_SERVER_PORT=53000 \
SERVER_PORT=8400 \
NODE_ID=proxy1 \
DB_PORT=6380 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

MODE=worker \
MASTER_SERVER_IP=127.0.0.1 \
MASTER_SERVER_PORT=7003 \
TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45003 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5300 \
MQ_SERVICE_SERVER_PORT=53000 \
SERVER_PORT=8400 \
NODE_ID=proxy1 \
DB_PORT=6380 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45003 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5301 \
MQ_SERVICE_SERVER_PORT=53001 \
SERVER_PORT=8401 \
NODE_ID=proxy2 \
DB_PORT=6381 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node --security-revert=CVE-2023-46809 build/server.js &

wait
