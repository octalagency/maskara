#!/bin/bash
# Hostinger Browser Terminal — deploy failed হলে paste করুন
set -euo pipefail
cd /opt/maskara 2>/dev/null || { echo "No /opt/maskara — Mac থেকে: bash scripts/remote-deploy.py"; exit 1; }

echo "=== Diagnose ==="
docker ps -a
echo ""
docker compose -f docker-compose.prod.yml ps -a 2>&1 || true
echo ""
docker images | grep maskara || echo "No maskara images — build needed"

if ! docker images | grep -q maskara-backend; then
  echo ""
  echo "=== Building images on VPS (15-20 min) ==="
  docker build -t octalagency/maskara-backend:latest ./backend
  docker build \
    --build-arg NEXT_PUBLIC_API_URL=https://api.maskara.bd \
    --build-arg NEXT_PUBLIC_APP_URL=https://app.maskara.bd \
    --build-arg NEXT_PUBLIC_PRODUCTION=true \
    -t octalagency/maskara-frontend:latest ./frontend
fi

mkdir -p docker/nginx/ssl
test -f docker/nginx/ssl/fullchain.pem || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem -subj "/CN=maskara.bd"

echo ""
echo "=== Pull base images ==="
docker pull redis:7-alpine postgres:16-alpine nginx:alpine

echo "=== Starting stack ==="
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d

sleep 20
docker compose -f docker-compose.prod.yml ps

echo ""
docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health || docker logs maskara-backend --tail 30

docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend npx prisma db seed 2>/dev/null || true

echo ""
echo "Done → https://app.maskara.bd"
