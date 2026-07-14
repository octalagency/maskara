#!/bin/bash
# Hostinger Browser Terminal — ship admin Google TTS settings UI
set -euo pipefail
cd /opt/maskara

git fetch origin main
git reset --hard origin/main

docker compose -f docker-compose.hostinger.yml build --no-cache frontend
docker compose -f docker-compose.hostinger.yml up -d frontend nginx

echo "Waiting 25s..."
sleep 25
docker compose -f docker-compose.hostinger.yml ps frontend

echo ""
echo "✓ Frontend updated"
echo "  Open: https://app.maskara.bd/admin/settings"
echo "  Hard refresh: Ctrl+Shift+R (Mac: Cmd+Shift+R)"
echo "  Look for card: Google Cloud TTS → API Key → Connect Google TTS"
