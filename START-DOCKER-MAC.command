#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/docker-env-init.sh
bash scripts/docker-env-init.sh
echo ""
echo "Building and starting Docker stack..."
docker compose -f docker-compose.hostinger.yml build --no-cache backend frontend
docker compose -f docker-compose.hostinger.yml up -d
echo ""
echo "Waiting 90s for backend..."
sleep 90
docker compose -f docker-compose.hostinger.yml ps
docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health/live 2>/dev/null && echo "Backend OK" || docker logs maskara-backend --tail 30
echo ""
echo "Open: https://app.maskara.bd/admin (add hosts: 127.0.0.1 app.maskara.bd api.maskara.bd)"
read -p "Press Enter to close..."
