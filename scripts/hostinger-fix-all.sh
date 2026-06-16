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
EOF
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

echo "Waiting 90s..."
sleep 90

echo "=== Status ==="
docker compose -f docker-compose.hostinger.yml ps

echo "=== Seed admin ==="
docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 maskara-backend npx prisma db seed

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
