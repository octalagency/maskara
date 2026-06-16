#!/bin/bash
set -e
cd "$(dirname "$0")/.."
export PATH="$(pwd)/.tools/node/bin:$PATH"

if ! command -v node &>/dev/null; then
  echo "Node install হচ্ছে..."
  mkdir -p .tools
  curl -fsSL https://nodejs.org/dist/v22.16.0/node-v22.16.0-darwin-arm64.tar.gz -o .tools/node.tar.gz
  tar -xzf .tools/node.tar.gz -C .tools
  mv .tools/node-v22.16.0-darwin-arm64 .tools/node
  rm .tools/node.tar.gz
  export PATH="$(pwd)/.tools/node/bin:$PATH"
fi

PORT="${PORT:-3002}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000}"

# Stop old frontend
for pid in $(lsof -ti:"$PORT" 2>/dev/null); do
  echo "Port $PORT — stopping PID $pid"
  kill -9 "$pid" 2>/dev/null || true
done
sleep 2

cd frontend
[ -d node_modules ] || npm install

# plugin zip
if [ ! -f public/downloads/maskara-woocommerce.zip ]; then
  echo "Plugin zip তৈরি হচ্ছে..."
  (cd .. && ./scripts/build-woo-plugin.sh)
fi

echo "Frontend rebuild হচ্ছে..."
NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL npm run build

if [ -d .next/standalone ]; then
  cp -r public .next/standalone/public 2>/dev/null || true
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
fi

echo ""
echo "✓ Frontend → http://localhost:$PORT"
echo "✓ Plugin (API)  → $NEXT_PUBLIC_API_URL/downloads/maskara-woocommerce.zip"
echo "✓ Plugin (local)→ http://localhost:$PORT/downloads/maskara-woocommerce.zip"
echo "✓ Docs          → http://localhost:$PORT/docs"
echo ""

if [ -f .next/standalone/server.js ]; then
  PORT=$PORT HOSTNAME=0.0.0.0 node .next/standalone/server.js
else
  PORT=$PORT NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL npm run start
fi
