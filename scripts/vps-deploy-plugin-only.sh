#!/bin/bash
# Hostinger Browser Terminal — plugin zip + update.json only (no full rebuild)
set -euo pipefail
cd /opt/maskara

git fetch origin main
git reset --hard origin/main

# Next.js serves /app/public — copy latest plugin artifacts into running container
docker cp frontend/public/downloads/maskara-woocommerce-update.json \
  maskara-frontend:/app/public/downloads/maskara-woocommerce-update.json
docker cp frontend/public/downloads/maskara-woocommerce.zip \
  maskara-frontend:/app/public/downloads/maskara-woocommerce.zip
docker cp frontend/public/downloads/maskara-woocommerce.zip \
  maskara-frontend:/app/public/maskara-woocommerce.zip 2>/dev/null || true
docker cp frontend/public/downloads/maskara-woocommerce.zip \
  maskara-frontend:/app/public/maskara-woocommerce-1.5.9.zip 2>/dev/null || true

echo "Live check:"
wget -qO- "http://127.0.0.1:3000/downloads/maskara-woocommerce-update.json" 2>/dev/null \
  || docker exec maskara-frontend wget -qO- http://127.0.0.1:3000/downloads/maskara-woocommerce-update.json
echo ""
echo "✓ Plugin 1.5.9 live — WordPress → Plugins → Check for updates"
