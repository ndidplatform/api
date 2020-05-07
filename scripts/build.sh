#!/bin/sh

cd mq-server
npm run build
cd ..

cd main-server
npm run build
