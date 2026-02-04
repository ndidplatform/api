#!/bin/sh

docker run --rm -p 6379:6379 --name ndid_redis_test_1 redis:5-alpine
