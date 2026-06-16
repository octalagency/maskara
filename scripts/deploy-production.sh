#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "╔══════════════════════════════════════════════════╗"
echo "║       Maskara Production Deploy                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

if [ ! -f .env ]; then
  echo "✗ .env file missing. Copy from .env.production.example"
  exit 1
fi

# shellcheck disable=SC1091
source .env

required_vars=(
  JWT_SECRET
  POSTGRES_PASSWORD
  API_URL
  PUBLIC_API_URL
  FRONTEND_URL
  APP_URL
  VOICE_WEBHOOK_SECRET
  WOOCOMMERCE_WEBHOOK_SECRET
  DOCKER_USERNAME
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "✗ Missing required env: $var"
    exit 1
  fi
done

if [[ ! "$PUBLIC_API_URL" =~ ^https:// ]]; then
  echo "✗ PUBLIC_API_URL must be HTTPS for ePBX callbacks"
  exit 1
fi

echo "[1/4] Building images..."
docker compose -f docker-compose.prod.yml build 2>/dev/null || {
  echo "  Using pre-built images from Docker Hub..."
}

echo "[2/4] Starting services..."
export RUN_SEED=false
export NEXT_PUBLIC_PRODUCTION=true
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo "[3/4] Waiting for health..."
for i in $(seq 1 30); do
  if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
    echo "  ✓ API healthy"
    break
  fi
  sleep 3
  if [ "$i" -eq 30 ]; then
    echo "✗ API health check failed"
    docker compose -f docker-compose.prod.yml logs backend --tail 30
    exit 1
  fi
done

echo "[4/4] Creating admin user (one-time)..."
echo "  Run on server:"
echo "  docker exec -it maskara-backend npx prisma db seed"
echo "  (set RUN_SEED=true ADMIN_EMAIL=... ADMIN_INITIAL_PASSWORD=... first)"
echo ""
echo "✓ Deploy complete"
echo "  App:  ${FRONTEND_URL}"
echo "  API:  ${API_URL}"
echo "  ePBX: ${PUBLIC_API_URL}/voice/webhook/epbx"
