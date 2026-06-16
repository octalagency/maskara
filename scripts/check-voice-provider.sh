#!/bin/bash
cd "$(dirname "$0")/.."
API="${API_URL:-http://localhost:4000}"

echo "=== Maskara Voice Provider Check ==="
echo ""

set -a
source .env 2>/dev/null || true
set +a

echo "VOICE_PROVIDER=${VOICE_PROVIDER:-auto}"
echo ""

for key in EPBX_API_KEY IPPBX_API_KEY TWILIO_ACCOUNT_SID; do
  val="${!key}"
  if [ -n "$val" ]; then
    echo "✓ $key set"
  else
    echo "✗ $key not set"
  fi
done

echo ""
RESP=$(curl -sf "$API/voice/provider" 2>/dev/null || echo '{"error":"backend down"}')
echo "Active provider: $RESP"
echo ""

if echo "$RESP" | grep -q '"provider":"epbx"'; then
  echo "✓ Using ePBX.bd (~৳0.40/min)"
elif echo "$RESP" | grep -q '"provider":"ippbx"'; then
  echo "✓ Using ippbx.com.bd (~৳0.40/min)"
elif echo "$RESP" | grep -q '"provider":"twilio"'; then
  echo "⚠ Using Twilio (~৳6/min) — consider ePBX for Bangladesh"
else
  echo "⚠ Simulate mode — no real calls"
  echo "  Setup: docs/EPBX-BANGLA.md"
fi
