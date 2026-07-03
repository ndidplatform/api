#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Create a clean directory for certs
OUTPUT_DIR="."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo "=========================================="
echo "Generating mTLS Certificates for Redis..."
echo "=========================================="

# 1. Create Certificate Authority (CA)
echo "-> Creating Certificate Authority..."
openssl genrsa -out "$OUTPUT_DIR/ca.key" 4096

openssl req -x509 -new -nodes \
  -key "$OUTPUT_DIR/ca.key" \
  -sha256 -days 365 \
  -out "$OUTPUT_DIR/ca.crt" \
  -subj "/CN=LocalRedisCA/O=Development/C=TH"

# 2. Create Redis Server Certificate
echo "-> Creating Redis Server Certs..."
openssl genrsa -out "$OUTPUT_DIR/server.key" 2048

# Create a temporary OpenSSL configuration file for SAN extension
cat > "$OUTPUT_DIR/server_ext.cnf" <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
EOF

# Generate Server Certificate Signing Request (CSR)
# Note: For local dev, 'localhost' and '127.0.0.1' are added as SANs
openssl req -new \
  -key "$OUTPUT_DIR/server.key" \
  -out "$OUTPUT_DIR/server.csr" \
  -subj "/CN=127.0.0.1/O=Development/C=TH"

# Sign the Server CSR with our CA
openssl x509 -req \
  -in "$OUTPUT_DIR/server.csr" \
  -CA "$OUTPUT_DIR/ca.crt" \
  -CAkey "$OUTPUT_DIR/ca.key" \
  -CAcreateserial \
  -out "$OUTPUT_DIR/server.crt" \
  -extfile "$OUTPUT_DIR/server_ext.cnf" \
  -days 365 -sha256

# 3. Create Client Certificate (for your Node.js app)
echo "-> Creating Node.js Client Certs..."
openssl genrsa -out "$OUTPUT_DIR/client.key" 2048

# Generate Client CSR
openssl req -new \
  -key "$OUTPUT_DIR/client.key" \
  -out "$OUTPUT_DIR/client.csr" \
  -subj "/CN=RedisClient/O=Development/C=TH"

# Sign the Client CSR with our CA
openssl x509 -req \
  -in "$OUTPUT_DIR/client.csr" \
  -CA "$OUTPUT_DIR/ca.crt" \
  -CAkey "$OUTPUT_DIR/ca.key" \
  -CAcreateserial \
  -out "$OUTPUT_DIR/client.crt" \
  -days 365 -sha256

# 4. Clean up CSR and serial files we don't need anymore
rm "$OUTPUT_DIR/server.csr" "$OUTPUT_DIR/client.csr" "$OUTPUT_DIR/server_ext.cnf"

# 5. Crucial: Fix file permissions so Docker container can read them
chmod 644 "$OUTPUT_DIR"/*

echo "=========================================="
echo " Done! Certificates generated in $OUTPUT_DIR"
echo "=========================================="
ls -lh "$OUTPUT_DIR"