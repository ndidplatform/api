#!/bin/sh

set -e

openssl genrsa -out key.pem 2048

openssl rsa -in key.pem -outform PEM -pubout -out key.pub.pem
