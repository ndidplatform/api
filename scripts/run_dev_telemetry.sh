#!/bin/sh

cd telemetry

NODE_ID=idp1,rp1 \
PMS_DB_IP=localhost PMS_DB_PORT=6379 \
TELEMETRY_NODE_IP=localhost TELEMETRY_NODE_PORT=8880 \
FLUSH_INTERVAL_SEC=2 \
npm start
