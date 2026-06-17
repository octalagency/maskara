#!/bin/bash
# Hostinger Browser Terminal — পুরো project delete + fresh deploy
set -euo pipefail

echo "╔══════════════════════════════════════════════════╗"
echo "║  Maskara FRESH DEPLOY (full wipe + rebuild)      ║"
echo "╚══════════════════════════════════════════════════╝"

command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; systemctl enable --now docker; }

echo "=== 1. Stop and remove everything ==="
if [ -d /opt/maskara ]; then
  cd /opt/maskara
  docker compose -f docker-compose.hostinger.yml down -v --remove-orphans 2>/dev/null || true
  cd /
fi

docker rm -f maskara-backend maskara-frontend maskara-worker maskara-nginx maskara-postgres maskara-redis 2>/dev/null || true
docker volume rm -f maskara_postgres_data maskara_redis_data 2>/dev/null || true
docker volume ls -q | grep -i maskara | xargs -r docker volume rm -f 2>/dev/null || true
docker rmi -f maskara-backend:local maskara-frontend:local 2>/dev/null || true
docker image prune -f 2>/dev/null || true

echo "=== 2. Delete old code ==="
rm -rf /opt/maskara

echo "=== 3. Fresh clone ==="
git clone https://github.com/octalagency/maskara.git /opt/maskara
cd /opt/maskara

echo "=== 4. New .env ==="
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
RUN_SEED=true
EOF

echo "=== 5. SSL certs ==="
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/CN=maskara.bd"

echo "=== 6. Build config ==="
cat > backend/tsconfig.build.json <<'EOF'
{"extends":"./tsconfig.json","compilerOptions":{"rootDir":"src","outDir":"./dist"},"include":["src/**/*"],"exclude":["node_modules","dist","test","**/*.spec.ts","**/*.test.ts"]}
EOF

echo "=== 7. Pull base images ==="
docker pull redis:7-alpine postgres:16-alpine nginx:alpine 2>/dev/null || true

echo "=== 8. Build (15-25 min) ==="
docker compose -f docker-compose.hostinger.yml build --no-cache backend frontend

echo "=== 9. Start all services ==="
docker compose -f docker-compose.hostinger.yml up -d --remove-orphans

echo "Waiting 150s..."
sleep 150

echo "=== 10. Status ==="
docker compose -f docker-compose.hostinger.yml ps

if ! docker inspect maskara-backend --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
  echo "=== Backend logs ==="
  docker logs maskara-backend --tail 60
  echo "=== Health log ==="
  docker inspect maskara-backend --format '{{range .State.Health.Log}}{{.Output}}{{end}}' 2>/dev/null | tail -c 800 || true
  exit 1
fi

echo "=== 11. Admin + seed ==="
docker exec -e ADMIN_EMAIL=admin@maskara.bd -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend node scripts/ensure-admin.js
docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 maskara-backend npx prisma db seed 2>/dev/null || true

echo "=== 12. Verify ==="
docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health/live
echo ""
curl -sk -o /dev/null -w "api.maskara.bd → HTTP %{http_code}\n" https://api.maskara.bd/health/live || true
curl -sk -o /dev/null -w "app.maskara.bd → HTTP %{http_code}\n" https://app.maskara.bd/ || true

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✓ FRESH DEPLOY DONE                             ║"
echo "╚══════════════════════════════════════════════════╝"
echo "  https://app.maskara.bd/admin"
echo "  https://app.maskara.bd/login"
echo "  admin@maskara.bd / Admin@123"
echo "  Cloudflare SSL: Full"
