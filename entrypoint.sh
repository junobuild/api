#!/usr/bin/env sh
set -e

KEY_DIR="/usr/src/app/keys"
PRIVATE_KEY="$KEY_DIR/private-key.pem"
PUBLIC_KEY="$KEY_DIR/public-key.pem"

echo "Generating RSA key pair..."

# Generate private key
openssl genrsa -out "$PRIVATE_KEY" 2048

# Extract public key
openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY"

chmod 600 "$PRIVATE_KEY"
chmod 644 "$PUBLIC_KEY"

export JWT_PRIVATE_KEY_PATH="$PRIVATE_KEY"
export JWT_PUBLIC_KEY_PATH="$PUBLIC_KEY"

echo "Generating key id..."

export JWT_KEY_ID="juno-api-$(date +%s)"

echo "Key env:"
echo "JWT_PRIVATE_KEY_PATH=$JWT_PRIVATE_KEY_PATH"
echo "JWT_PUBLIC_KEY_PATH=$JWT_PUBLIC_KEY_PATH"
echo "JWT_KEY_ID=$JWT_KEY_ID"

# Start the application
exec ./server