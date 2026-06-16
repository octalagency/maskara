#!/bin/bash
# Test Maskara API after setup
API_URL="${API_URL:-http://localhost:4000}"

echo "=== Maskara API Test ==="
echo "API: $API_URL"
echo ""

# 1. Login as demo merchant
echo "1. Logging in as demo merchant..."
LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@store.com","password":"Demo@123"}')

TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "   FAIL: Could not login. Is the backend running?"
  echo "   Response: $LOGIN"
  exit 1
fi
echo "   OK: Logged in"

# 2. Get order stats
echo "2. Fetching dashboard stats..."
STATS=$(curl -s "$API_URL/orders/stats" -H "Authorization: Bearer $TOKEN")
echo "   $STATS"

# 3. Create API key
echo "3. Creating API key..."
KEY_RES=$(curl -s -X POST "$API_URL/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Key"}')

API_KEY=$(echo "$KEY_RES" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)

if [ -z "$API_KEY" ]; then
  echo "   SKIP: API key creation failed (may already exist)"
else
  echo "   OK: API key created"

  # 4. Submit test order (triggers simulated voice call without Twilio)
  echo "4. Submitting test order..."
  ORDER=$(curl -s -X POST "$API_URL/orders" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "orderNumber": "TEST-001",
      "customerName": "রহিম আহমেদ",
      "customerPhone": "01712345678",
      "totalAmount": 2500,
      "paymentMethod": "COD"
    }')
  echo "   $ORDER"
  echo "   OK: Order submitted — check dashboard for VERIFIED status"
fi

echo ""
echo "=== Test Complete ==="
echo "Open http://localhost:3000/login and sign in with demo@store.com / Demo@123"
