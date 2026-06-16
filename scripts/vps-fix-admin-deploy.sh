#!/bin/bash
# VPS — admin login fix + redeploy
set -euo pipefail
cd /opt/maskara 2>/dev/null || { echo "No /opt/maskara"; exit 1; }

echo "=== Pull latest ==="
git pull origin main 2>/dev/null || true

echo "=== Redeploy ==="
bash scripts/vps-redeploy.sh

echo "=== Seed admin ==="
docker exec -e RUN_SEED=true \
  -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend npx prisma db seed

echo "=== Test login API ==="
curl -s -X POST http://127.0.0.1:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@maskara.bd","password":"Admin@123"}' | head -c 200
echo ""
echo "Done → https://app.maskara.bd/admin"
