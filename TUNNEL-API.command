#!/bin/bash
cd "$(dirname "$0")"
export PATH="$(pwd)/.tools/node/bin:$PATH"

echo "=== Maskara API Tunnel (filobeauty.xyz এর জন্য) ==="
echo ""

# API port — 4000 busy হলে 4005 ব্যবহার
API_PORT=4000
if lsof -ti:4000 &>/dev/null; then
  if ! curl -sf "http://localhost:4000/integrations/woocommerce/ping" -H "X-API-Key: test" 2>/dev/null | grep -q '"ok"'; then
    echo "⚠ Port 4000-এ পুরনো API — 4005-এ নতুন API চালু হচ্ছে..."
    API_PORT=4005
    lsof -ti:4005 | xargs kill -9 2>/dev/null || true
    PORT=4005 node standalone-api/server.js &
    sleep 2
  fi
else
  chmod +x scripts/run-standalone.sh
  ./scripts/run-standalone.sh &
  sleep 2
fi

if ! curl -sf "http://localhost:$API_PORT/health" >/dev/null; then
  echo "✗ API start হয়নি"
  read -p "Press Enter..."
  exit 1
fi

echo "✓ API: http://localhost:$API_PORT"
echo ""
echo "Tunnel URL WordPress plugin-এ দিন:"
echo ""

if [ -x .tools/cloudflared ]; then
  .tools/cloudflared tunnel --url "http://localhost:$API_PORT"
elif command -v ngrok &>/dev/null; then
  ngrok http "$API_PORT"
else
  echo "cloudflared/ngrok নেই। Terminal-এ চালান:"
  echo "  ./.tools/cloudflared tunnel --url http://localhost:$API_PORT"
  echo ""
  echo "যে https://....trycloudflare.com URL পাবেন সেটা plugin-এ Maskara API URL হিসেবে দিন।"
  read -p "Press Enter..."
fi
