#!/bin/bash
cd "$(dirname "$0")/.."
set -a
source .env 2>/dev/null || true
set +a

echo "=== Twilio Configuration Check ==="
echo ""

if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ]; then
  echo "✗ TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing in .env"
  echo "  Guide: docs/TWILIO-BANGLA.md"
  exit 1
fi

echo "✓ Credentials found"
echo "  SID: ${TWILIO_ACCOUNT_SID:0:8}..."
echo "  Phone: ${TWILIO_PHONE_NUMBER:-NOT SET}"

if [ -z "$TWILIO_PHONE_NUMBER" ]; then
  echo "✗ TWILIO_PHONE_NUMBER missing"
  exit 1
fi

# Verify with Twilio API
RESP=$(curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json")

if echo "$RESP" | grep -q '"status"'; then
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | head -1)
  echo "✓ Twilio account valid — $STATUS"
else
  echo "✗ Invalid credentials"
  echo "  $RESP"
  exit 1
fi

if [ -n "$PUBLIC_API_URL" ]; then
  echo "✓ PUBLIC_API_URL=$PUBLIC_API_URL (webhooks will use this)"
else
  echo "⚠ PUBLIC_API_URL not set — local dev needs ngrok for real calls"
  echo "  See: docs/TWILIO-BANGLA.md Step 4"
fi

echo ""
echo "After updating .env:"
echo "  docker compose restart backend worker"
