#!/bin/bash
cd "$(dirname "$0")"
export PATH="$(pwd)/.tools/node/bin:$PATH"

echo "=== Maskara Payment PGW Local Update ==="
echo ""

for pid in $(lsof -ti:4000 2>/dev/null); do
  echo "Stopping API on :4000 (PID $pid)"
  kill -9 "$pid" 2>/dev/null || true
done
for pid in $(lsof -ti:3002 2>/dev/null); do
  echo "Stopping frontend on :3002 (PID $pid)"
  kill -9 "$pid" 2>/dev/null || true
done
sleep 2

echo "Starting API..."
nohup node standalone-api/server.js > /tmp/maskara-api.log 2>&1 &
sleep 2

echo "Rebuilding frontend..."
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run build
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true

echo "Starting frontend on :3002..."
PORT=3002 HOSTNAME=0.0.0.0 node .next/standalone/server.js &
sleep 2

echo ""
curl -sf http://localhost:4000/health && echo " ✓ API :4000"
curl -sf -o /dev/null http://localhost:3002/admin/config && echo " ✓ Frontend :3002"
echo ""
echo "Admin Payment: http://localhost:3002/admin/payments"
echo "Admin Voice:   http://localhost:3002/admin/config"
echo "Login: admin@maskara.bd / Admin@123"
open http://localhost:3002/admin/payments 2>/dev/null || true
