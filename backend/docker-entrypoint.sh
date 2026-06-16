#!/bin/sh
set -e

echo "Running database migrations..."
MIGRATED=
for i in 1 2 3 4 5 6 7 8 9 10; do
  if npx prisma migrate deploy; then
    MIGRATED=1
    break
  fi
  echo "  migrate attempt $i failed, retrying in 3s..."
  sleep 3
done
if [ -z "$MIGRATED" ]; then
  echo "ERROR: database migration failed"
  exit 1
fi

echo "Ensuring admin account..."
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_INITIAL_PASSWORD:-}" ]; then
  npx prisma db seed || true
elif [ "$RUN_SEED" = "true" ]; then
  echo "  RUN_SEED=true — running prisma db seed"
  npx prisma db seed || true
else
  echo "  Set ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD for auto admin"
fi

echo "Starting application..."
exec "$@"
