#!/bin/bash

trap killgroup SIGINT

killgroup(){
  echo killing...
  kill 0
}

SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
DEV_CERT_DIR="$SCRIPT_DIR/../../dev_cert"
REDIS_DEV_CERT_DIR="$DEV_CERT_DIR/redis"

# redis-server --port 6379 &
# redis-server --port 6380 &
# redis-server --port 6381 &

# redis-cli -p 6379 FLUSHALL
# redis-cli -p 6380 FLUSHALL
# redis-cli -p 6381 FLUSHALL

docker run --rm -p 6379:6379 --name ndid_redis_1 \
  -v $REDIS_DEV_CERT_DIR:/certs \
  redis:6-alpine \
  redis-server \
  --tls-port 6379 \
  --port 0 \
  --tls-cert-file /certs/server.crt \
  --tls-key-file /certs/server.key \
  --tls-ca-cert-file /certs/ca.crt \
  --tls-auth-clients yes &

cd main-server

TENDERMINT_IP=127.0.0.1 \
TENDERMINT_PORT=45000 \
DB_IP=127.0.0.1 \
DB_TLS=true \
DB_TLS_CA_PATH="$REDIS_DEV_CERT_DIR/ca.crt" \
DB_TLS_KEY_PATH="$REDIS_DEV_CERT_DIR/client.key" \
DB_TLS_CERT_PATH="$REDIS_DEV_CERT_DIR/client.crt" \
NODE_ID=ndid1 \
NDID_NODE=true \
ENABLE_CONFIG_HTTP_ROUTE_PATH=true \
ENABLE_TELEMETRY_LOGGING=false \
node build/server.js &

wait