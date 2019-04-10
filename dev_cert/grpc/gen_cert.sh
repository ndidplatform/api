#!/bin/sh

echo "Generating certificates ..."

openssl genrsa -out ca.key 4096

openssl req -new -x509 -days 36500 -key ca.key -out ca.crt -subj  "/C=TH/ST=Bangkok/O=NDID/OU=DevTest/CN=ca"

openssl genrsa -out server.key 4096

openssl req -new -key server.key -out server.csr -subj  "/C=TH/ST=Bangkok/O=NDID/OU=DevTest/CN=localhost"

openssl x509 -req -days 36500 -in server.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out server.crt

openssl rsa -in server.key -out server.key

openssl genrsa -out client.key 4096

openssl req -new -key client.key -out client.csr -subj  "/C=TH/ST=Bangkok/O=NDID/OU=DevTest/CN=localhost"

openssl x509 -req -days 36500 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out client.crt

openssl rsa -in client.key -out client.key