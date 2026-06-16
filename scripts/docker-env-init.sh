#!/bin/bash
# Creates .env with required keys for docker compose (Mac or VPS)
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env"
touch "$ENV_FILE"

add_if_missing() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    return
  fi
  echo "${key}=${value}" >> "$ENV_FILE"
  echo "  + ${key}"
}

echo "=== Maskara Docker .env setup ==="

add_if_missing POSTGRES_USER "maskara"
add_if_missing POSTGRES_DB "maskara"
add_if_missing POSTGRES_PASSWORD "$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
add_if_missing JWT_SECRET "$(openssl rand -hex 32)"
add_if_missing VOICE_WEBHOOK_SECRET "$(openssl rand -hex 24)"
add_if_missing WOOCOMMERCE_WEBHOOK_SECRET "$(openssl rand -hex 24)"
add_if_missing APP_URL "https://app.maskara.bd"
add_if_missing API_URL "https://api.maskara.bd"
add_if_missing PUBLIC_API_URL "https://api.maskara.bd"
add_if_missing FRONTEND_URL "https://app.maskara.bd"
add_if_missing EPBX_API_KEY "znoOkJcxs6TdrKGreQ7Iobx5uTmvwMFwOHGcCQPR"
add_if_missing ADMIN_EMAIL "admin@maskara.bd"
add_if_missing ADMIN_INITIAL_PASSWORD "Admin@123"

mkdir -p docker/nginx/ssl
if [ ! -f docker/nginx/ssl/fullchain.pem ]; then
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout docker/nginx/ssl/privkey.pem \
    -out docker/nginx/ssl/fullchain.pem \
    -subj "/CN=maskara.bd"
  echo "  + self-signed SSL certs"
fi

echo ""
echo "✓ .env ready"
echo ""
echo "Mac local test — add to /etc/hosts:"
echo "  127.0.0.1 app.maskara.bd api.maskara.bd"
echo ""
echo "Then run:"
echo "  docker compose -f docker-compose.hostinger.yml build --no-cache backend"
echo "  docker compose -f docker-compose.hostinger.yml up -d"
