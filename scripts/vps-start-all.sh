#!/bin/bash
# Hostinger Browser Terminal — সব server চালু (একবার paste করুন)
set -euo pipefail

echo "╔══════════════════════════════════════════════════╗"
echo "║  Maskara — Start All Servers                     ║"
echo "╚══════════════════════════════════════════════════╝"

command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; systemctl enable --now docker; }

if [ ! -d /opt/maskara/.git ]; then
  rm -rf /opt/maskara
  git clone https://github.com/octalagency/maskara.git /opt/maskara
fi
cd /opt/maskara
git pull origin main

# .env
if [ ! -f .env ]; then
  JWT=$(openssl rand -hex 32)
  PG=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
  cat > .env <<EOF
POSTGRES_USER=maskara
POSTGRES_PASSWORD=$PG
POSTGRES_DB=maskara
JWT_SECRET=$JWT
VOICE_WEBHOOK_SECRET=$(openssl rand -hex 24)
WOOCOMMERCE_WEBHOOK_SECRET=$(openssl rand -hex 24)
APP_URL=https://app.maskara.bd
API_URL=https://api.maskara.bd
PUBLIC_API_URL=https://api.maskara.bd
FRONTEND_URL=https://app.maskara.bd
EPBX_API_KEY=znoOkJcxs6TdrKGreQ7Iobx5uTmvwMFwOHGcCQPR
VOICE_PROVIDER=epbx
EPBX_API_URL=https://maskara.epbx.bd/api/v1
ADMIN_EMAIL=admin@maskara.bd
ADMIN_INITIAL_PASSWORD=Admin@123
EOF
else
  grep -q '^PUBLIC_API_URL=' .env || echo 'PUBLIC_API_URL=https://api.maskara.bd' >> .env
  grep -q '^VOICE_WEBHOOK_SECRET=' .env || echo "VOICE_WEBHOOK_SECRET=$(openssl rand -hex 24)" >> .env
  grep -q '^WOOCOMMERCE_WEBHOOK_SECRET=' .env || echo "WOOCOMMERCE_WEBHOOK_SECRET=$(openssl rand -hex 24)" >> .env
fi

# Postgres password must match volume
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^maskara-postgres$'; then
  PG_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2- | tr -d '"')
  if ! docker exec -e PGPASSWORD="$PG_PASS" maskara-postgres psql -U maskara -d maskara -c 'SELECT 1' >/dev/null 2>&1; then
    echo "Postgres password mismatch — resetting DB volume..."
    docker compose -f docker-compose.hostinger.yml down || true
    docker volume rm -f maskara_postgres_data 2>/dev/null || true
  fi
fi

mkdir -p docker/nginx/ssl
[ -f docker/nginx/ssl/fullchain.pem ] || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem -out docker/nginx/ssl/fullchain.pem -subj "/CN=maskara.bd"

cat > backend/tsconfig.build.json <<'EOF'
{"extends":"./tsconfig.json","compilerOptions":{"rootDir":"src","outDir":"./dist"},"include":["src/**/*"],"exclude":["node_modules","dist","test","**/*.spec.ts","**/*.test.ts"]}
EOF

echo "=== Pull base images ==="
docker pull redis:7-alpine postgres:16-alpine nginx:alpine 2>/dev/null || true

echo "=== Build backend + frontend (15-25 min) ==="
docker compose -f docker-compose.hostinger.yml build --no-cache backend frontend

echo "=== Start all services ==="
docker compose -f docker-compose.hostinger.yml up -d --remove-orphans

echo "Waiting 120s..."
sleep 120

echo "=== Status ==="
docker compose -f docker-compose.hostinger.yml ps

if ! docker inspect maskara-backend --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
  echo "=== Backend logs ==="
  docker logs maskara-backend --tail 60
  docker exec maskara-backend test -f dist/main.js 2>/dev/null || echo "dist/main.js MISSING — rebuild failed"
  exit 1
fi

echo "=== Admin user ==="
docker exec -e ADMIN_EMAIL=admin@maskara.bd -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend node scripts/ensure-admin.js 2>/dev/null || true

echo "=== Health ==="
docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health/live
echo ""
curl -sk -o /dev/null -w "api.maskara.bd: HTTP %{http_code}\n" https://api.maskara.bd/health/live || true
curl -sk -o /dev/null -w "app.maskara.bd: HTTP %{http_code}\n" https://app.maskara.bd/ || true

echo ""
echo "✓ DONE"
echo "  https://app.maskara.bd/admin"
echo "  https://app.maskara.bd/login"
echo "  admin@maskara.bd / Admin@123"
echo "  Cloudflare SSL: Full"
