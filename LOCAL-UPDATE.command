#!/bin/bash
cd "$(dirname "$0")"
export PATH="$(pwd)/.tools/node/bin:$PATH"

echo "=== Maskara Local Update ==="
echo ""

# Kill old processes
for port in 4000 3002 3003 3010 3011 4010; do
  for pid in $(lsof -ti:$port 2>/dev/null); do
    echo "Stopping PID $pid on :$port"
    kill -9 "$pid" 2>/dev/null || true
  done
done
sleep 2

echo "[1/3] Starting API on :4000..."
nohup node standalone-api/server.js > /tmp/maskara-api.log 2>&1 &
sleep 2

echo "[2/3] Building frontend..."
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run build
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true

echo "[3/3] Starting frontend on :3002..."
PORT=3002 HOSTNAME=0.0.0.0 nohup node .next/standalone/server.js > /tmp/maskara-frontend.log 2>&1 &
sleep 3

echo ""
curl -sf http://localhost:4000/health && echo " ✓ API :4000"
curl -sf -o /dev/null http://localhost:3002/admin/payments && echo " ✓ Payment Gateway :3002/admin/payments"
curl -sf -o /dev/null http://localhost:3002/admin/config && echo " ✓ Voice Config :3002/admin/config"
echo ""
echo "Login: admin@maskara.bd / Admin@123"
echo ""
echo "  Payment Gateway → http://localhost:3002/admin/payments"
echo "  Voice Config    → http://localhost:3002/admin/config"
open http://localhost:3002/admin/payments 2>/dev/null || true
