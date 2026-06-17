#!/bin/sh
set -e

PRISMA="./node_modules/.bin/prisma"

echo "=== Maskara backend startup ==="
node -e "
const required = ['JWT_SECRET','DATABASE_URL','REDIS_URL','API_URL','PUBLIC_API_URL','FRONTEND_URL','VOICE_WEBHOOK_SECRET','WOOCOMMERCE_WEBHOOK_SECRET'];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error('ERROR: missing env:', missing.join(', '));
  process.exit(1);
}
if ((process.env.JWT_SECRET || '').length < 32) {
  console.error('ERROR: JWT_SECRET must be at least 32 characters');
  process.exit(1);
}
console.log('✓ env preflight ok');
console.log('  DATABASE_URL host:', (process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':***@'));
"

if [ ! -x "$PRISMA" ]; then
  echo "Installing prisma CLI..."
  npm install prisma@6.1.0 --no-audit --no-fund
fi
echo "Prisma: $($PRISMA --version)"

echo "Testing database connection..."
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$connect()
  .then(() => { console.log('✓ database connection ok'); return p.\$disconnect(); })
  .catch((e) => { console.error('ERROR: database connection failed:', e.message); process.exit(1); });
"

echo "Running database migrations..."
MIGRATED=
for i in 1 2 3 4 5 6 7 8 9 10; do
  if "$PRISMA" migrate deploy 2>&1; then
    MIGRATED=1
    break
  fi
  echo "  migrate attempt $i failed, retrying in 5s..."
  sleep 5
done
if [ -z "$MIGRATED" ]; then
  echo "WARN: migrate deploy failed — trying prisma db push..."
  if "$PRISMA" db push --skip-generate 2>&1; then
    MIGRATED=1
    echo "✓ schema synced via db push"
  else
    echo "ERROR: database migration failed"
    "$PRISMA" migrate status 2>&1 || true
    exit 1
  fi
fi

if [ ! -f dist/main.js ] && [ -f dist/src/main.js ]; then
  echo "Normalizing compiled output dist/src -> dist/"
  cp -a dist/src/. dist/
  rm -rf dist/src
fi
if [ ! -f dist/main.js ]; then
  echo "ERROR: dist/main.js missing — rebuild backend image with --no-cache"
  ls -la dist 2>/dev/null || echo "  dist/ directory missing"
  exit 1
fi

echo "Ensuring admin account..."
node scripts/ensure-admin.js || true
if [ "$RUN_SEED" = "true" ]; then
  echo "  RUN_SEED=true — running prisma db seed"
  "$PRISMA" db seed || true
fi

echo "Starting application..."
exec "$@"
