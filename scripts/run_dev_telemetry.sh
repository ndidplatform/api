#!/bin/sh

cd telemetry

NODE_ID=idp1,rp1 \
DB_IP=localhost DB_PORT=6379 \
TELEMETRY_NODE_IP=localhost TELEMETRY_NODE_PORT=8880 \
FLUSH_INTERVAL=2000 \
npm start
