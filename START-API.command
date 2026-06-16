#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/run-standalone.sh

echo "=== Maskara Standalone API ==="
echo "WooCommerce + API Key endpoints সহ"
echo ""

./scripts/run-standalone.sh &
API_PID=$!
sleep 2

if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
  echo "✓ API: http://localhost:4000"
  echo "✓ WooCommerce ping: GET /integrations/woocommerce/ping"
  echo "✓ Merchant panel: http://localhost:3002/dashboard/integrations"
  echo "  demo@store.com / Demo@123"
  open http://localhost:3002/dashboard/integrations 2>/dev/null || true
else
  echo "✗ API start হয়নি — port 4000 check করুন"
fi

echo ""
echo "এই window খোলা রাখুন। বন্ধ করতে Ctrl+C"
wait $API_PID
