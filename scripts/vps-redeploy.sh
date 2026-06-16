#!/bin/bash
# Hostinger Browser Terminal — code already uploaded হলে
set -euo pipefail
cd /opt/maskara

echo "=== Maskara quick deploy ==="
docker compose -f docker-compose.hostinger.yml build --no-cache backend frontend
docker compose -f docker-compose.hostinger.yml up -d --remove-orphans

echo "Waiting 60s..."
sleep 60
docker compose -f docker-compose.hostinger.yml ps

docker exec maskara-nginx wget -qO- http://frontend:3000/ >/dev/null && echo "✓ frontend OK" || docker logs maskara-frontend --tail 20
docker exec maskara-backend node -e "require('http').get('http://127.0.0.1:4000/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('backend',r.statusCode,d))})" 2>/dev/null || docker logs maskara-backend --tail 20

docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 maskara-backend npx prisma db seed 2>/dev/null || true

echo ""
echo "→ https://app.maskara.bd/admin"
echo "  admin@maskara.bd / Admin@123"
