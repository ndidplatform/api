#!/bin/sh

set -e

# secp256r1 / prime256v1
openssl ecparam -name prime256v1 -genkey -noout -out key.pem

# secp256k1
# openssl ecparam -name secp256k1 -genkey -noout -out key.pem

# secp384r1
# openssl ecparam -name secp384r1 -genkey -noout -out key.pem

openssl ec -in key.pem -pubout -out key.pub.pem
