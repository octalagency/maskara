#!/bin/bash
# VPS-এ backend build error ঠিক করে rebuild (Hostinger terminal-এ চালান)
set -euo pipefail
cd /opt/maskara || { echo "✗ /opt/maskara নেই"; exit 1; }

echo "=== Maskara backend build hotfix ==="

# 1. admin.service.ts — lastName যোগ
ADMIN="backend/src/admin/admin.service.ts"
if ! grep -q 'lastName: data.name' "$ADMIN" 2>/dev/null; then
  perl -i -0pe 's/(firstName: data\.name,\n)(\s+role:)/$1            lastName: data.name,\n$2/s' "$ADMIN"
  echo "✓ $ADMIN — lastName added"
else
  echo "· $ADMIN — already fixed"
fi

# 2. payments.service.spec.ts — import path
SPEC="backend/src/payments/payments.service.spec.ts"
if [ -f "$SPEC" ]; then
  sed -i "s|from '../payments.service'|from './payments.service'|g" "$SPEC"
  echo "✓ $SPEC — import fixed"
fi

# 3. webhooks.module.ts — guard import
WEB="backend/src/webhooks/webhooks.module.ts"
if ! grep -q 'WooCommerceWebhookGuard' "$WEB" 2>/dev/null || ! grep -q "from '../common/guards/woocommerce-webhook.guard'" "$WEB"; then
  if ! grep -q "woocommerce-webhook.guard" "$WEB"; then
    sed -i "/import { OrdersModule }/a import { WooCommerceWebhookGuard } from '../common/guards/woocommerce-webhook.guard';" "$WEB"
  fi
  echo "✓ $WEB — guard import added"
else
  echo "· $WEB — already fixed"
fi

# 4. tsconfig — exclude spec files from production build
TS="backend/tsconfig.json"
if ! grep -q '\*\*/\*\.spec\.ts' "$TS" 2>/dev/null; then
  perl -i -pe 's/\n}\s*$/,\n  "exclude": ["node_modules", "dist", "**\/*.spec.ts", "**\/*.test.ts"]\n}\n/s' "$TS"
  echo "✓ $TS — exclude spec files"
else
  echo "· $TS — already fixed"
fi

# 5. tsconfig.build.json — Nest must emit dist/main.js
BUILD_TS="backend/tsconfig.build.json"
cat > "$BUILD_TS" <<'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts", "**/*.test.ts"]
}
EOF
echo "✓ $BUILD_TS — fixed include/rootDir"

# 6. nest-cli — use tsconfig.build.json
NEST="backend/nest-cli.json"
if ! grep -q 'tsconfig.build.json' "$NEST" 2>/dev/null; then
  sed -i 's/"deleteOutDir": true/"deleteOutDir": true,\n    "tsConfigPath": "tsconfig.build.json"/' "$NEST"
  echo "✓ $NEST — tsConfigPath set"
fi

echo ""
echo "Rebuilding backend..."
docker compose -f docker-compose.hostinger.yml build backend --no-cache
docker compose -f docker-compose.hostinger.yml up -d

sleep 10
docker compose -f docker-compose.hostinger.yml ps
curl -sf http://127.0.0.1:4000/health && echo "" && echo "✓ API healthy" || echo "⚠ API not ready yet — wait 1-2 min then: curl http://127.0.0.1:4000/health"
echo "Open: https://app.maskara.bd/admin"
