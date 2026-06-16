#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Maskara Real System (Docker) ==="

# Stop standalone API — port 4000 conflict
chmod +x scripts/stop-standalone.sh
./scripts/stop-standalone.sh

# Try to open Docker Desktop
if ! docker info &>/dev/null; then
  echo ""
  echo "Docker Desktop খোলা হচ্ছে..."
  for app in "/Applications/Docker.app" "$HOME/Applications/Docker.app"; do
    if [ -d "$app" ]; then
      open -a Docker 2>/dev/null || open "$app" 2>/dev/null || true
      break
    fi
  done
  echo "Docker start হওয়া পর্যন্ত অপেক্ষা (max 90s)..."
  for i in $(seq 1 45); do
    if docker info &>/dev/null; then
      echo "✓ Docker ready"
      break
    fi
    sleep 2
  done
fi

if ! docker info &>/dev/null; then
  echo ""
  echo "✗ Docker Desktop চালু হয়নি।"
  echo "  1. Applications → Docker manually open করুন"
  echo "  2. Whale icon stable হওয়া পর্যন্ত wait করুন"
  echo "  3. FIX.command আবার double-click করুন"
  exit 1
fi

mkdir -p docker/nginx/ssl

echo ""
echo "[1/3] Building images (first time: 3-5 min)..."
docker compose build backend worker frontend

echo ""
echo "[2/3] Starting postgres, redis, backend, worker, frontend..."
docker compose up -d --force-recreate postgres redis backend worker frontend

echo ""
echo "[3/3] Waiting for backend..."
OK=0
for i in $(seq 1 60); do
  if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
    BODY=$(curl -sf http://localhost:4000/health)
    if echo "$BODY" | grep -q "maskara-api"; then
      OK=1
      echo "✓ Real NestJS backend is UP"
      break
    fi
  fi
  printf "  waiting... %s/60\r" "$i"
  sleep 2
done
echo ""

docker compose ps

echo ""
echo "=== URLs ==="
echo "  Admin:    http://localhost:3000/admin/login"
echo "  API Docs: http://localhost:4000/docs"
echo "  Health:   http://localhost:4000/health"
echo ""
echo "  admin@maskara.bd / Admin@123"

if [ "$OK" -eq 0 ]; then
  echo ""
  echo "✗ Backend not ready. Logs:"
  docker compose logs backend --tail 40
  exit 1
fi

# Twilio check
if grep -q '^TWILIO_ACCOUNT_SID=.\+' .env 2>/dev/null; then
  echo ""
  echo "✓ Twilio credentials found in .env"
else
  echo ""
  echo "⚠ Twilio not configured — calls will SIMULATE (auto-verify)"
  echo "  Setup guide: docs/TWILIO-BANGLA.md"
fi

echo ""
echo "✓ Real system running!"
open http://localhost:3000/admin/login 2>/dev/null || true
