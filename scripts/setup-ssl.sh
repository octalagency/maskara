#!/bin/bash
# SSL certificate setup with Let's Encrypt (run on VPS as root)
# Usage: sudo ./scripts/setup-ssl.sh maskara.bd www.maskara.bd app.maskara.bd api.maskara.bd

set -euo pipefail
cd "$(dirname "$0")/.."

DOMAINS=("$@")
if [ ${#DOMAINS[@]} -eq 0 ]; then
  DOMAINS=(maskara.bd www.maskara.bd app.maskara.bd api.maskara.bd)
fi
EMAIL="${SSL_EMAIL:-admin@maskara.bd}"

echo "=== SSL Setup for: ${DOMAINS[*]} ==="

if ! command -v certbot &>/dev/null; then
  echo "Installing certbot..."
  if command -v apt-get &>/dev/null; then
    apt-get update && apt-get install -y certbot
  elif command -v brew &>/dev/null; then
    brew install certbot
  else
    echo "Install certbot manually"
    exit 1
  fi
fi

docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

mkdir -p docker/nginx/ssl

CERT_ARGS=()
for domain in "${DOMAINS[@]}"; do
  CERT_ARGS+=(-d "$domain")
done

certbot certonly --standalone \
  "${CERT_ARGS[@]}" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

PRIMARY="${DOMAINS[0]}"
cp "/etc/letsencrypt/live/${PRIMARY}/fullchain.pem" docker/nginx/ssl/fullchain.pem
cp "/etc/letsencrypt/live/${PRIMARY}/privkey.pem" docker/nginx/ssl/privkey.pem
chmod 644 docker/nginx/ssl/fullchain.pem
chmod 600 docker/nginx/ssl/privkey.pem

docker compose -f docker-compose.prod.yml up -d nginx

echo "✓ SSL configured for: ${DOMAINS[*]}"
echo "  Renew: certbot renew"
