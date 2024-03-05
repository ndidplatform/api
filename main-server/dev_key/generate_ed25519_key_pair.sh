#!/bin/sh

set -e

openssl genpkey -algorithm ed25519 -out key.pem

openssl pkey -in key.pem -pubout -out key.pub.pem
