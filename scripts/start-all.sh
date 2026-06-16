#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Maskara — Fix & Start All Servers ==="

if ! docker info &>/dev/null; then
  echo ""
  echo "ERROR: Docker Desktop চালু নেই!"
  echo "1. Docker Desktop open করুন"
  echo "2. আবার run করুন: ./scripts/start-all.sh"
  exit 1
fi

mkdir -p docker/nginx/ssl

echo ""
echo "[1/4] Stopping broken backend containers..."
docker compose stop backend worker 2>/dev/null || true
docker compose rm -f backend worker 2>/dev/null || true

echo ""
echo "[2/4] Rebuilding images (backend + frontend)..."
echo "      (প্রথমবার 2-5 মিনিট লাগতে পারে)"
docker compose build --no-cache backend worker frontend

echo ""
echo "[3/4] Starting all services..."
docker compose up -d --force-recreate postgres redis backend worker frontend

echo ""
echo "[4/4] Waiting for backend..."
OK=0
for i in $(seq 1 45); do
  if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
    OK=1
    echo "✓ Backend is UP"
    break
  fi
  printf "  waiting... %s/45\r" "$i"
  sleep 2
done
echo ""

echo ""
echo "=== Container Status ==="
docker compose ps

echo ""
echo "=== URLs ==="
echo "  Admin Login: http://localhost:3000/admin/login"
echo "  API Docs:    http://localhost:4000/docs"
echo "  Health:      http://localhost:4000/health"
echo ""
echo "  Admin:    admin@maskara.bd / Admin@123"
echo "  Merchant: demo@store.com / Demo@123"

if [ "$OK" -eq 0 ]; then
  echo ""
  echo "✗ Backend এখনও ready নয়। Logs দেখুন:"
  echo "  docker compose logs backend --tail 60"
  exit 1
fi

echo ""
echo "✓ সব ঠিক আছে! Browser-এ admin login করুন।"
