#!/bin/sh

cd telemetry

NODE_ID=idp1,idp2,idp3,rp1,rp2,as1 \
TELEMETRY_DB_IP=localhost \
TELEMETRY_DB_PORT=6379 \
TELEMETRY_NODE_IP=localhost \
TELEMETRY_NODE_PORT=8880 \
FLUSH_INTERVAL_SEC=20 \
npm start
