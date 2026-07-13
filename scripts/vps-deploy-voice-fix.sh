#!/bin/bash
# Hostinger Browser Terminal — rebuild backend so Azure Pradeep voice goes live
set -euo pipefail
cd /opt/maskara

git fetch origin main
git reset --hard origin/main

docker compose -f docker-compose.hostinger.yml build --no-cache backend frontend
docker compose -f docker-compose.hostinger.yml up -d backend frontend worker nginx

echo "Waiting 40s..."
sleep 40
docker compose -f docker-compose.hostinger.yml ps
docker logs maskara-backend --tail 30 2>&1 | grep -iE 'voice|epbx|pradeep|error|Nest' || true

echo ""
echo "✓ Backend+frontend rebuilt"
echo "  Settings → প্রদীপ select → new test call"
echo "  Expect male Azure voice (not নবনীতা)"
