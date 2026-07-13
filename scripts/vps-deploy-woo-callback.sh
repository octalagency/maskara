#!/bin/bash
set -e
cd /opt/maskara
echo "=== Rebuild backend+worker (Woo callback) ==="
docker compose -f docker-compose.hostinger.yml up -d --build backend worker
docker compose -f docker-compose.hostinger.yml ps
echo "=== DONE ==="
echo "WordPress: upload/replace plugin maskara-woocommerce v1.1.0"
echo "Then: WooCommerce → Maskara → Connect again + match Webhook Secret"
