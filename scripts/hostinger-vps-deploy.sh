#!/bin/bash
# Hostinger Browser Terminal-এ paste করে চালান (SSH ছাড়া)
set -euo pipefail

echo "=== Maskara Production (Hostinger VPS) ==="

apt update -qq
apt install -y docker.io docker-compose-plugin openssl curl 2>/dev/null || true
systemctl enable --now docker

mkdir -p /opt/maskara
cd /opt/maskara

if [ ! -f docker-compose.prod.yml ]; then
  echo "✗ /opt/maskara empty — Mac থেকে PRODUCTION-PUSH.command চালান প্রথমে"
  exit 1
fi

if [ ! -f .env ]; then
  cat > .env <<'ENV'
NODE_ENV=production
POSTGRES_USER=maskara
POSTGRES_PASSWORD=CHANGE_ME_STRONG
POSTGRES_DB=maskara
JWT_SECRET=CHANGE_ME_JWT_64_CHARS_MIN
VOICE_WEBHOOK_SECRET=CHANGE_ME_VOICE
WOOCOMMERCE_WEBHOOK_SECRET=CHANGE_ME_WOO
APP_URL=https://app.maskara.bd
API_URL=https://api.maskara.bd
PUBLIC_API_URL=https://api.maskara.bd
FRONTEND_URL=https://app.maskara.bd
DOCKER_USERNAME=octalagency
IMAGE_TAG=latest
VOICE_PROVIDER=epbx
EPBX_API_URL=https://maskara.epbx.bd/api/v1
EPBX_API_KEY=znoOkJcxs6TdrKGreQ7Iobx5uTmvwMFwOHGcCQPR
ENV
  echo "⚠ .env created — nano .env করে secrets update করুন"
  nano .env
fi

mkdir -p docker/nginx/ssl
if [ ! -f docker/nginx/ssl/fullchain.pem ]; then
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout docker/nginx/ssl/privkey.pem \
    -out docker/nginx/ssl/fullchain.pem \
    -subj "/CN=maskara.bd"
fi

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans

sleep 20
docker compose -f docker-compose.prod.yml ps

docker exec -e RUN_SEED=true \
  -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend npx prisma db seed 2>/dev/null || true

echo ""
echo "✓ Done"
echo "  https://app.maskara.bd"
echo "  https://api.maskara.bd/health"
curl -s http://127.0.0.1:4000/health || docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health
