#!/bin/sh
set -e

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
"

echo "Running database migrations..."
if ! npx prisma --version >/dev/null 2>&1; then
  echo "ERROR: prisma CLI missing in container image"
  exit 1
fi

MIGRATED=
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if npx prisma migrate deploy 2>&1; then
    MIGRATED=1
    break
  fi
  echo "  migrate attempt $i failed, retrying in 5s..."
  sleep 5
done
if [ -z "$MIGRATED" ]; then
  echo "ERROR: database migration failed after 15 attempts"
  echo "  Check DATABASE_URL / POSTGRES_PASSWORD match the postgres volume"
  npx prisma migrate status 2>&1 || true
  exit 1
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
  npx prisma db seed || true
fi

echo "Starting application..."
exec "$@"
