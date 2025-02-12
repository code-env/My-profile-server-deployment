#!/bin/bash

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    echo "OpenSSL is required but not installed. Please install it first."
    exit 1
fi

# Create certs directory if it doesn't exist
mkdir -p certs

# Generate self-signed SSL certificate and private key
# DO NOT USE SELF-SIGNED CERTIFICATES IN PRODUCTION
echo "Generating self-signed SSL certificate and private key..."
openssl req -x509 \
    -newkey rsa:4096 \
    -keyout certs/key.pem \
    -out certs/cert.pem \
    -days 365 \
    -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Set permissions
chmod 600 certs/key.pem
chmod 644 certs/cert.pem

echo "SSL certificate and key have been generated:"
echo "  - Private key: certs/key.pem"
echo "  - Certificate: certs/cert.pem"
echo
echo "WARNING: Self-signed certificates should not be used in production!"
echo "For production, use certificates from a trusted Certificate Authority."
