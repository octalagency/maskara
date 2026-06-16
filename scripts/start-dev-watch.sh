#!/bin/bash
# Maskara — Live dev mode (no Docker)
# Frontend: Next.js hot reload | API: node --watch auto-restart
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.tools/node/bin:$PATH"

if ! command -v node &>/dev/null; then
  echo "Node install হচ্ছে..."
  mkdir -p .tools
  curl -fsSL https://nodejs.org/dist/v22.16.0/node-v22.16.0-darwin-arm64.tar.gz -o .tools/node.tar.gz
  tar -xzf .tools/node.tar.gz -C .tools
  mv .tools/node-v22.16.0-darwin-arm64 .tools/node
  rm .tools/node.tar.gz
  export PATH="$ROOT/.tools/node/bin:$PATH"
fi

API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-3002}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:$API_PORT}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:$WEB_PORT}"

echo "=== Maskara Dev Watch Mode ==="
echo "Frontend hot reload: :$WEB_PORT"
echo "API auto-restart:    :$API_PORT"
echo ""

# Free ports
for port in $API_PORT $WEB_PORT 3010 3011 4010; do
  for pid in $(lsof -ti:$port 2>/dev/null); do
    echo "Stopping PID $pid on :$port"
    kill -9 "$pid" 2>/dev/null || true
  done
done
sleep 1

# Plugin zip (WooCommerce download)
if [ ! -f frontend/public/downloads/maskara-woocommerce.zip ]; then
  chmod +x scripts/build-woo-plugin.sh 2>/dev/null || true
  ./scripts/build-woo-plugin.sh 2>/dev/null || true
fi

# ePBX config from .env
bash scripts/configure-epbx-local.sh 2>/dev/null || true

# API with file watch
echo "Starting API (node --watch)..."
PORT=$API_PORT node --watch standalone-api/server.js > /tmp/maskara-api-dev.log 2>&1 &
API_PID=$!
sleep 2

if ! curl -sf "http://localhost:$API_PORT/health" >/dev/null; then
  echo "✗ API start হয়নি। Log:"
  tail -10 /tmp/maskara-api-dev.log
  exit 1
fi
echo "✓ API http://localhost:$API_PORT"

# Frontend dev server
echo "Starting Frontend (next dev)..."
cd frontend
[ -d node_modules ] || npm install
PORT=$WEB_PORT NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL npm run dev > /tmp/maskara-frontend-dev.log 2>&1 &
WEB_PID=$!
cd ..

echo "Waiting for frontend..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://localhost:$WEB_PORT" 2>/dev/null; then
    break
  fi
  sleep 1
done

echo ""
echo "=========================================="
echo "  ✓ Maskara Dev Running"
echo "=========================================="
echo ""
echo "  Landing:         http://localhost:$WEB_PORT"
echo "  Admin Login:     http://localhost:$WEB_PORT/admin/login"
echo "  Payment Gateway: http://localhost:$WEB_PORT/admin/payments"
echo "  Voice Config:    http://localhost:$WEB_PORT/admin/config"
echo "  Merchant:        http://localhost:$WEB_PORT/dashboard"
echo "  API Health:      http://localhost:$API_PORT/health"
echo ""
echo "  Admin:    admin@maskara.bd / Admin@123"
echo "  Merchant: demo@store.com / Demo@123"
echo ""
echo "  কোড এডিট করলে frontend স্বয়ংক্রিয় আপডেট হবে।"
echo "  API ফাইল এডিট করলে node --watch রিস্টার্ট করবে।"
echo ""
echo "  Logs:"
echo "    tail -f /tmp/maskara-frontend-dev.log"
echo "    tail -f /tmp/maskara-api-dev.log"
echo ""
echo "  বন্ধ করতে: Ctrl+C"
echo "=========================================="

open "http://localhost:$WEB_PORT" 2>/dev/null || true

trap 'kill $API_PID $WEB_PID 2>/dev/null; exit 0' INT TERM
wait
