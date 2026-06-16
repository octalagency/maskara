#!/bin/bash
# Hostinger Browser Terminal — backend unhealthy fix
set -euo pipefail
cd /opt/maskara

echo "=== Pull latest fixes ==="
git pull origin main

echo "=== Backend logs ==="
docker logs maskara-backend --tail 100 2>&1 || true

echo "=== Rebuild backend + worker ==="
docker compose -f docker-compose.hostinger.yml build --no-cache backend
docker compose -f docker-compose.hostinger.yml up -d backend worker

echo "Waiting 120s..."
sleep 120
docker compose -f docker-compose.hostinger.yml ps

echo "=== Ensure admin ==="
docker exec -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend node scripts/ensure-admin.js 2>/dev/null || true

docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health/live && echo "backend live OK"
echo "→ https://app.maskara.bd/admin"
