#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Maskara Frontend Update ==="
echo "নতুন Admin মেনু (Plans, Billing, Config) দেখতে frontend rebuild করছি..."
echo ""

if ! docker info &>/dev/null; then
  echo "Docker চালু নেই। Docker Desktop open করুন, তারপর আবার চালান।"
  exit 1
fi

echo "[1/2] Frontend image build (2-3 min)..."
docker compose build --no-cache frontend

echo ""
echo "[2/2] Frontend container restart..."
docker compose up -d --force-recreate frontend

echo ""
echo "✓ Done! Browser refresh করুন:"
echo "  http://localhost:3000/admin"
echo ""
open http://localhost:3000/admin 2>/dev/null || true
