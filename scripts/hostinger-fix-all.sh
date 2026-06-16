#!/bin/bash
# Hostinger Browser Terminal — 502 + login fix (একবার paste করুন)
set -euo pipefail

echo "=== Maskara full fix + deploy ==="

# Docker
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; systemctl enable --now docker; }

# Code
if [ ! -d /opt/maskara/.git ]; then
  rm -rf /opt/maskara
  git clone https://github.com/octalagency/maskara.git /opt/maskara
fi
cd /opt/maskara
git pull origin main || true

# .env
ensure_env_key() {
  local key="$1"
  local val="$2"
  if [ ! -f .env ] || ! grep -q "^${key}=" .env; then
    echo "${key}=${val}" >> .env
  fi
}

if [ ! -f .env ]; then
  JWT=$(openssl rand -hex 32)
  PG=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
  cat > .env <<EOF
POSTGRES_PASSWORD=$PG
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
  ensure_env_key PUBLIC_API_URL "https://api.maskara.bd"
  ensure_env_key FRONTEND_URL "https://app.maskara.bd"
  ensure_env_key VOICE_WEBHOOK_SECRET "$(openssl rand -hex 24)"
  ensure_env_key WOOCOMMERCE_WEBHOOK_SECRET "$(openssl rand -hex 24)"
fi

# Postgres password must match existing volume (common cause of unhealthy backend)
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^maskara-postgres$'; then
  PG_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2- | tr -d '"')
  if ! docker exec -e PGPASSWORD="$PG_PASS" maskara-postgres psql -U maskara -d maskara -c 'SELECT 1' >/dev/null 2>&1; then
    echo "WARNING: POSTGRES_PASSWORD in .env does not match database volume — resetting postgres data"
    docker compose -f docker-compose.hostinger.yml down || true
    docker volume rm -f maskara_postgres_data 2>/dev/null || true
  fi
fi

# SSL (self-signed — Cloudflare SSL mode: Full)
mkdir -p docker/nginx/ssl
[ -f docker/nginx/ssl/fullchain.pem ] || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem -out docker/nginx/ssl/fullchain.pem -subj "/CN=maskara.bd"

# Build config fix
cat > backend/tsconfig.build.json <<'EOF'
{"extends":"./tsconfig.json","compilerOptions":{"rootDir":"src","outDir":"./dist"},"include":["src/**/*"],"exclude":["node_modules","dist","test","**/*.spec.ts","**/*.test.ts"]}
EOF

echo "=== Building (15-25 min) ==="
docker pull redis:7-alpine postgres:16-alpine nginx:alpine 2>/dev/null || true
docker compose -f docker-compose.hostinger.yml build --no-cache backend frontend
docker compose -f docker-compose.hostinger.yml up -d --remove-orphans

echo "Waiting 120s for backend health..."
sleep 120

echo "=== Status ==="
docker compose -f docker-compose.hostinger.yml ps

if ! docker inspect maskara-backend --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
  echo "=== Backend logs (unhealthy) ==="
  docker logs maskara-backend --tail 80 2>&1 || true
  echo ""
  echo "Retrying backend only..."
  docker compose -f docker-compose.hostinger.yml up -d --build backend worker
  sleep 90
  docker compose -f docker-compose.hostinger.yml ps
fi

echo "=== Ensure admin ==="
docker exec -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend node scripts/ensure-admin.js 2>/dev/null || \
docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 maskara-backend npx prisma db seed 2>/dev/null || true

echo "=== Test ==="
docker exec maskara-nginx wget -qO- http://frontend:3000/ >/dev/null && echo "frontend OK" || docker logs maskara-frontend --tail 10
docker exec maskara-backend node -e "require('http').get('http://127.0.0.1:4000/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('health',r.statusCode))})" || docker logs maskara-backend --tail 10
curl -s -X POST http://127.0.0.1:4000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@maskara.bd","password":"Admin@123"}' | head -c 120
echo ""
echo ""
echo "DONE → https://app.maskara.bd/admin"
echo "Login: admin@maskara.bd / Admin@123"
echo "Cloudflare SSL: Full (not Strict)"
