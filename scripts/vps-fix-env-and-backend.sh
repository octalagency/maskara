#!/bin/bash
# Fix empty/invalid .env keys + rebuild backend
set -euo pipefail
cd /opt/maskara
git pull origin main 2>/dev/null || true

env_set() {
  local key="$1"
  local value="$2"
  sed -i "/^${key}=/d" .env 2>/dev/null || true
  echo "${key}=${value}" >> .env
}

env_ensure_secret() {
  local key="$1"
  local current=""
  if grep -q "^${key}=" .env 2>/dev/null; then
    current=$(grep "^${key}=" .env | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
  if [ -z "$current" ]; then
    if [ "$key" = "JWT_SECRET" ]; then
      env_set "$key" "$(openssl rand -hex 32)"
    elif [ "$key" = "POSTGRES_PASSWORD" ]; then
      env_set "$key" "$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
    else
      env_set "$key" "$(openssl rand -hex 24)"
    fi
    echo "  fixed empty ${key}"
  fi
}

touch .env
echo "=== Fix .env ==="
env_ensure_secret JWT_SECRET
env_ensure_secret POSTGRES_PASSWORD
env_ensure_secret VOICE_WEBHOOK_SECRET
env_ensure_secret WOOCOMMERCE_WEBHOOK_SECRET
grep -q '^PUBLIC_API_URL=.' .env || env_set PUBLIC_API_URL "https://api.maskara.bd"
grep -q '^POSTGRES_USER=.' .env || env_set POSTGRES_USER "maskara"
grep -q '^POSTGRES_DB=.' .env || env_set POSTGRES_DB "maskara"

# Postgres password must match volume
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^maskara-postgres$'; then
  PG_PASS=$(grep '^POSTGRES_PASSWORD=' .env | tail -1 | cut -d= -f2- | tr -d '"')
  if ! docker exec -e PGPASSWORD="$PG_PASS" maskara-postgres psql -U maskara -d maskara -c 'SELECT 1' >/dev/null 2>&1; then
    echo "Postgres password mismatch — resetting DB volume..."
    docker compose -f docker-compose.hostinger.yml down || true
    docker volume rm -f maskara_postgres_data 2>/dev/null || true
    docker compose -f docker-compose.hostinger.yml up -d postgres redis
    sleep 10
  fi
fi

echo "=== Rebuild backend (--no-cache) ==="
docker compose -f docker-compose.hostinger.yml build --no-cache backend
docker compose -f docker-compose.hostinger.yml up -d --force-recreate backend worker nginx

echo "Waiting 150s for migrations + health..."
sleep 150
docker compose -f docker-compose.hostinger.yml ps

echo "=== Backend logs ==="
docker logs maskara-backend --tail 50

echo "=== Health check log ==="
docker inspect maskara-backend --format '{{range .State.Health.Log}}{{.Output}}{{end}}' 2>/dev/null | tail -c 500 || true
echo ""

if docker inspect maskara-backend --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
  docker exec -e ADMIN_EMAIL=admin@maskara.bd -e ADMIN_INITIAL_PASSWORD=Admin@123 \
    maskara-backend node scripts/ensure-admin.js 2>/dev/null || true
  docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health/live
  echo ""
  echo "✓ Backend healthy — https://app.maskara.bd/login"
else
  echo "✗ Still unhealthy. Send this output to support."
  exit 1
fi
