#!/bin/bash

# Create a directory to store the individual logs
LOG_DIR="$(pwd)/logs"
mkdir -p "$LOG_DIR"

trap cleanup SIGINT

cleanup() {
  echo -e "\nStopping all processes..."
  # Get PIDs of all active background jobs running under this shell
  local pids=$(jobs -p)
  if [ -n "$pids" ]; then
    kill -TERM $pids 2>/dev/null
    wait $pids 2>/dev/null # Wait for them to actually exit
  fi
  echo "Cleanup complete."
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

export LOG_LEVEL=debug
export LOG_COLOR=false
export LOG_REDACT_SENSITIVE_DATA=false

# 1. MQ Servers
cd mq-server

npm run build

NODE_ID=idp1 \
MQ_BINDING_PORT=5000 \
SERVER_PORT=50000 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_idp1.log" &

NODE_ID=idp2 \
MQ_BINDING_PORT=5001 \
SERVER_PORT=50001 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_idp2.log" &

NODE_ID=idp3 \
MQ_BINDING_PORT=5002 \
SERVER_PORT=50002 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_idp3.log" &

NODE_ID=rp1 \
MQ_BINDING_PORT=5100 \
SERVER_PORT=51000 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_rp1.log" &

NODE_ID=rp2 \
MQ_BINDING_PORT=5101 \
SERVER_PORT=51001 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_rp2.log" &

NODE_ID=as1 \
MQ_BINDING_PORT=5200 \
SERVER_PORT=52000 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_as1.log" &

NODE_ID=as2 \
MQ_BINDING_PORT=5201 \
SERVER_PORT=52001 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_as2.log" &

NODE_ID=proxy1 \
MQ_BINDING_PORT=5300 \
SERVER_PORT=53000 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_proxy1.log" &

NODE_ID=proxy2 \
MQ_BINDING_PORT=5301 \
SERVER_PORT=53001 \
node build/server.js 2>&1 | tee "$LOG_DIR/mq_proxy2.log" &

# 2. Main Servers
cd ../main-server

npm run build

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
NODE_ID=ndid1 \
NDID_NODE=true \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=false \
node build/server.js 2>&1 | tee "$LOG_DIR/main_ndid1.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_idp1_master.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_idp1_worker.log" &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5001 \
MQ_SERVICE_SERVER_PORT=50001 \
SERVER_PORT=8101 \
NODE_ID=idp2 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node build/server.js 2>&1 | tee "$LOG_DIR/main_idp2.log" &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5002 \
MQ_SERVICE_SERVER_PORT=50002 \
SERVER_PORT=8102 \
NODE_ID=idp3 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node build/server.js 2>&1 | tee "$LOG_DIR/main_idp3.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_rp1_master.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_rp1_worker.log" &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45001 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5101 \
MQ_SERVICE_SERVER_PORT=51001 \
SERVER_PORT=8201 \
NODE_ID=rp2 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node build/server.js 2>&1 | tee "$LOG_DIR/main_rp2.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_as1_master.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_as1_worker.log" &

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45002 \
MQ_CONTACT_IP=127.0.0.1 \
MQ_BINDING_PORT=5201 \
MQ_SERVICE_SERVER_PORT=52001 \
SERVER_PORT=8301 \
NODE_ID=as2 \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=true \
node build/server.js 2>&1 | tee "$LOG_DIR/main_as2.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_proxy1_master.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_proxy1_worker.log" &

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
node build/server.js 2>&1 | tee "$LOG_DIR/main_proxy2.log" &

wait