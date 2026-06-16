#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "======================================"
echo "  Maskara Docker Update"
echo "  (নতুন Admin UI + Backend)"
echo "======================================"
echo ""

# Stop standalone API — port 4000 conflict
chmod +x scripts/stop-standalone.sh 2>/dev/null || true
./scripts/stop-standalone.sh 2>/dev/null || true

if ! docker info &>/dev/null; then
  echo "Docker Desktop খোলা হচ্ছে..."
  chmod +x scripts/open-docker.sh 2>/dev/null || true
  ./scripts/open-docker.sh 2>/dev/null || true
  # Direct binary if open fails (broken .app wrapper)
  BIN="/Applications/Docker.app/Contents/MacOS/Docker Desktop.app/Contents/MacOS/Docker Desktop"
  [ -x "$BIN" ] && "$BIN" &>/dev/null &
  for i in $(seq 1 45); do
    docker info &>/dev/null && echo "✓ Docker ready" && break
    printf "  waiting... %s/45\r" "$i"
    sleep 2
  done
  echo ""
fi

if ! docker info &>/dev/null; then
  echo ""
  echo "✗ Docker চালু হয়নি।"
  echo "  1. Applications → Docker Desktop manually open করুন"
  echo "  2. যদি open না হয় → Docker Desktop reinstall করুন"
  echo "  3. তারপর এই script আবার চালান"
  exit 1
fi

echo "[1/3] Building frontend + backend (3-5 min)..."
docker compose build --no-cache frontend backend

echo ""
echo "[2/3] Restarting containers..."
docker compose up -d --force-recreate postgres redis backend worker frontend

echo ""
echo "[3/3] Verifying..."
sleep 5
PLANS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/plans 2>/dev/null || echo "000")
HEALTH=$(curl -sf http://localhost:4000/health 2>/dev/null || echo "fail")

echo ""
docker compose ps
echo ""
echo "=== Results ==="
echo "  /admin/plans  → HTTP $PLANS_CODE (200 = OK)"
echo "  API health    → $HEALTH"
echo ""
if [ "$PLANS_CODE" = "200" ]; then
  echo "✓ Update successful! Browser refresh করুন:"
  open http://localhost:3000/admin 2>/dev/null || true
else
  echo "⚠ Frontend এখনও পুরনো হতে পারে। FIX.command চালান।"
fi
