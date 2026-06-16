#!/bin/bash
# VPS console-এ paste করে চালান (provider web terminal)
# Fixes: docker status, firewall, nginx, restart stack

set -euo pipefail
cd /opt/maskara 2>/dev/null || { echo "No /opt/maskara — deploy first"; exit 1; }

echo "=== Docker containers ==="
docker compose -f docker-compose.prod.yml ps -a

echo ""
echo "=== Backend logs (last 30) ==="
docker logs maskara-backend --tail 30 2>&1 || true

echo ""
echo "=== Nginx logs ==="
docker logs maskara-nginx --tail 20 2>&1 || true

echo ""
echo "=== Local health (inside VPS) ==="
curl -s http://127.0.0.1:4000/health 2>/dev/null || docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health 2>/dev/null || echo "backend not responding"
curl -s -o /dev/null -w "nginx:80 %{http_code}\n" http://127.0.0.1/ 2>/dev/null || echo "nginx not on 80"

echo ""
echo "=== Firewall ==="
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw status || true
fi

echo ""
echo "=== Restart stack ==="
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

sleep 15
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Test from VPS (direct IP, not Cloudflare) ==="
curl -sk https://127.0.0.1/health -H "Host: api.maskara.bd" || curl -s http://127.0.0.1/health -H "Host: api.maskara.bd" || true

echo ""
echo "Done. Browser test: https://app.maskara.bd"
