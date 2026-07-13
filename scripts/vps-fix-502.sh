#!/bin/bash
# 502 Bad Gateway fix — Hostinger VPS terminal
set -euo pipefail
cd /opt/maskara || { echo "✗ /opt/maskara নেই"; exit 1; }

COMPOSE="docker-compose.hostinger.yml"

echo "=== 1. Container status ==="
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep maskara || true

echo ""
echo "=== 2. Fix .env ==="
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
else
  add() { grep -q "^$1=" .env || echo "$1=$2" >> .env; }
  add API_URL "https://api.maskara.bd"
  add PUBLIC_API_URL "https://api.maskara.bd"
  add FRONTEND_URL "https://app.maskara.bd"
  add APP_URL "https://app.maskara.bd"
  grep -q '^JWT_SECRET=.\{32,\}' .env || {
    JWT=$(openssl rand -hex 32)
    grep -q '^JWT_SECRET=' .env && sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT/" .env || echo "JWT_SECRET=$JWT" >> .env
  }
  add VOICE_WEBHOOK_SECRET "$(openssl rand -hex 24)"
  add WOOCOMMERCE_WEBHOOK_SECRET "$(openssl rand -hex 24)"
fi

mkdir -p docker/nginx/ssl
[ -f docker/nginx/ssl/fullchain.pem ] || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem -subj "/CN=maskara.bd"

echo ""
echo "=== 3. Fix backend build config ==="
cat > backend/tsconfig.build.json <<'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts", "**/*.test.ts"]
}
EOF

echo ""
echo "=== 4. Pull base images ==="
docker pull redis:7-alpine postgres:16-alpine nginx:alpine 2>/dev/null || true

echo ""
echo "=== 5. Build + start all services ==="
docker compose -f "$COMPOSE" build --no-cache backend frontend
docker compose -f "$COMPOSE" up -d

echo "Waiting 60s for startup..."
sleep 60

echo ""
echo "=== 6. Status ==="
docker compose -f "$COMPOSE" ps

echo ""
echo "=== 7. Logs (if failing) ==="
docker logs maskara-backend --tail 15 2>&1 || true
docker logs maskara-frontend --tail 15 2>&1 || true
docker logs maskara-nginx --tail 10 2>&1 || true

echo ""
echo "=== 8. Internal checks ==="
docker exec maskara-nginx wget -qO- http://frontend:3000/ 2>/dev/null | head -c 80 && echo " ... frontend OK" || echo "✗ nginx → frontend failed"
docker exec maskara-backend node -e "require('http').get('http://127.0.0.1:4000/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('backend',r.statusCode,d))})" 2>/dev/null || echo "✗ backend not healthy"

docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 maskara-backend npx prisma db seed 2>/dev/null || true

echo ""
echo "Done → https://app.maskara.bd/admin"
echo "Cloudflare SSL mode: Full (not Strict) if using self-signed origin cert"
