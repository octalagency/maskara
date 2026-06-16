#!/bin/bash
set -e
cd "$(dirname "$0")/.."
export PATH="$(pwd)/.tools/node/bin:$PATH"

API_PORT=4005
TUNNEL_FILE="$(pwd)/TUNNEL-URL.txt"

echo "=== Maskara API + Tunnel ==="

# নতুন API (WooCommerce routes সহ) — সবসময় 4005
lsof -ti:$API_PORT | xargs kill -9 2>/dev/null || true
sleep 1
PORT=$API_PORT node standalone-api/server.js &
API_PID=$!
sleep 2

if ! curl -sf "http://localhost:$API_PORT/integrations/woocommerce/ping" \
  -H "X-API-Key: mk_demo_woocommerce_key_change_me" | grep -q '"ok"'; then
  echo "✗ API start failed on port $API_PORT"
  exit 1
fi
echo "✓ API ready: http://localhost:$API_PORT"

# Tunnel
if [ ! -x .tools/cloudflared ]; then
  echo "cloudflared download হচ্ছে..."
  mkdir -p .tools
  curl -fsSL -o .tools/cloudflared.tgz \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
  tar -xzf .tools/cloudflared.tgz -C .tools
  chmod +x .tools/cloudflared
  rm -f .tools/cloudflared.tgz
fi

echo "Tunnel খোলা হচ্ছে..."
.tools/cloudflared tunnel --url "http://localhost:$API_PORT" 2>&1 | tee /tmp/maskara-tunnel.log &
TUNNEL_PID=$!

# URL extract (max 30 sec wait)
for i in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/maskara-tunnel.log 2>/dev/null | head -1)
  if [ -n "$URL" ]; then
    echo "$URL" > "$TUNNEL_FILE"
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  WordPress Plugin Settings — copy করুন:              ║"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  Maskara API URL:                                    ║"
    echo "║  $URL"
    echo "║                                                      ║"
    echo "║  API Key:                                            ║"
    echo "║  mk_demo_woocommerce_key_change_me                   ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
    echo "Saved: $TUNNEL_FILE"
    open "$TUNNEL_FILE" 2>/dev/null || true
    break
  fi
  sleep 1
done

wait $TUNNEL_PID
