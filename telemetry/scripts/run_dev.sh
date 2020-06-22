#!/bin/sh

NODE_ID=node-tmp1,node-tmp2 \
DB_IP=localhost DB_PORT=6379 \
TELEMETRY_NODE_IP=localhost TELEMETRY_NODE_PORT=8880 \
npm start
