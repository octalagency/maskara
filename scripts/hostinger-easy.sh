#!/bin/bash
# সবচেয়ে সহজ — Hostinger Browser Terminal-এ paste করুন
set -euo pipefail
cd /opt/maskara || { echo "✗ /opt/maskara নেই"; exit 1; }

echo "=== Maskara Easy Deploy ==="

# .env
if [ ! -f .env ]; then
  JWT=$(openssl rand -hex 32)
  PG=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
  VOICE=$(openssl rand -hex 24)
  WOO=$(openssl rand -hex 24)
  cat > .env <<EOF
POSTGRES_PASSWORD=$PG
JWT_SECRET=$JWT
VOICE_WEBHOOK_SECRET=$VOICE
WOOCOMMERCE_WEBHOOK_SECRET=$WOO
APP_URL=https://app.maskara.bd
API_URL=https://api.maskara.bd
PUBLIC_API_URL=https://api.maskara.bd
FRONTEND_URL=https://app.maskara.bd
EPBX_API_KEY=
VOICE_PROVIDER=epbx
EPBX_API_URL=https://maskara.epbx.bd/api/v1
EOF
  echo "✓ .env created"
fi

mkdir -p docker/nginx/ssl
[ -f docker/nginx/ssl/fullchain.pem ] || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem -subj "/CN=maskara.bd"

docker pull redis:7-alpine postgres:16-alpine nginx:alpine 2>/dev/null || true

echo "Building + starting (২০-৩০ মিনিট — অপেক্ষা করুন)..."
docker compose -f docker-compose.hostinger.yml up -d --build

sleep 15
docker compose -f docker-compose.hostinger.yml ps

docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 maskara-backend npx prisma db seed 2>/dev/null || true

echo ""
echo "✓ Done → https://app.maskara.bd/admin"
echo "  admin@maskara.bd / Admin@123"
