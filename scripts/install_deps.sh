#!/bin/sh

cd ndid-logger
rm -rf node_modules
npm install
cd ..

cd main-server
rm -rf node_modules
npm install
cd ..

cd mq-server
rm -rf node_modules
npm install
